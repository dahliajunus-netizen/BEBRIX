-- BEBRIX server-side logic. All answer validation, scoring, XP and achievements run here,
-- never in the browser. Functions prefixed with "_" are internal and not callable by clients.

-- ---------------------------------------------------------------------------------------------
-- Grading
-- ---------------------------------------------------------------------------------------------
create or replace function public._grade(p_format text, p_key jsonb, p_response jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  a text;
  norm text;
begin
  if p_response is null or p_key is null then
    return false;
  end if;
  if p_format = 'single_choice' then
    return (p_response ->> 'choice') is not null and (p_response ->> 'choice') = (p_key -> 'correct' ->> 0);
  elsif p_format in ('multiple_choice', 'grid_select') then
    if jsonb_typeof(p_response -> 'choices') <> 'array' or jsonb_array_length(p_response -> 'choices') = 0 then
      return false;
    end if;
    return (select array_agg(distinct x order by x) from jsonb_array_elements_text(p_response -> 'choices') x)
         = (select array_agg(distinct x order by x) from jsonb_array_elements_text(p_key -> 'correct') x);
  elsif p_format = 'ordering' then
    return jsonb_typeof(p_response -> 'order') = 'array' and (p_response -> 'order') = (p_key -> 'correct');
  elsif p_format = 'short_answer' then
    a := btrim(coalesce(p_response ->> 'text', ''));
    if a = '' then
      return false;
    end if;
    if coalesce((p_key ->> 'caseSensitive')::boolean, false) then
      return exists (select 1 from jsonb_array_elements_text(p_key -> 'accepted') k where btrim(k) = a);
    end if;
    norm := upper(regexp_replace(a, '\s+', '', 'g'));
    return exists (
      select 1 from jsonb_array_elements_text(p_key -> 'accepted') k
      where upper(regexp_replace(k, '\s+', '', 'g')) = norm
    );
  end if;
  return false;
end $$;

create or replace function public._has_response(p_response jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p_response is not null and (
    coalesce(p_response ->> 'choice', '') <> ''
    or coalesce(btrim(p_response ->> 'text'), '') <> ''
    or (jsonb_typeof(p_response -> 'choices') = 'array' and jsonb_array_length(p_response -> 'choices') > 0)
    or (jsonb_typeof(p_response -> 'order') = 'array' and jsonb_array_length(p_response -> 'order') > 0)
  )
$$;

create or replace function public._xp_for(p_difficulty text) returns integer
language sql immutable set search_path = '' as $$
  select case p_difficulty when 'mudah' then 10 when 'sedang' then 15 when 'sulit' then 20 else 30 end
$$;

-- ---------------------------------------------------------------------------------------------
-- XP, streaks, achievements
-- ---------------------------------------------------------------------------------------------
-- Grants XP once per (user, reason, ref). Returns the amount actually granted (0 if already claimed).
create or replace function public._award_xp(p_user uuid, p_amount integer, p_reason text, p_ref text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  inserted integer;
begin
  insert into public.xp_events (user_id, amount, reason, ref)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict (user_id, reason, ref) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return 0;
  end if;
  perform set_config('app.trusted', 'on', true);
  update public.profiles set xp = xp + p_amount where id = p_user;
  perform set_config('app.trusted', 'off', true);
  insert into public.daily_activity (user_id, day, xp_earned)
  values (p_user, public.today_wib(), p_amount)
  on conflict (user_id, day) do update set xp_earned = public.daily_activity.xp_earned + excluded.xp_earned;
  return p_amount;
end $$;

create or replace function public._touch_activity(p_user uuid, p_answered integer, p_correct integer, p_time_ms bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.today_wib();
  last date;
begin
  insert into public.daily_activity (user_id, day, questions_answered, correct, time_spent_ms)
  values (p_user, today, p_answered, p_correct, greatest(p_time_ms, 0))
  on conflict (user_id, day) do update set
    questions_answered = public.daily_activity.questions_answered + excluded.questions_answered,
    correct = public.daily_activity.correct + excluded.correct,
    time_spent_ms = public.daily_activity.time_spent_ms + excluded.time_spent_ms;

  select last_active into last from public.profiles where id = p_user for update;
  if last is distinct from today then
    perform set_config('app.trusted', 'on', true);
    update public.profiles
    set streak = case when last = today - 1 then streak + 1 else 1 end,
        longest_streak = greatest(longest_streak, case when last = today - 1 then streak + 1 else 1 end),
        last_active = today
    where id = p_user;
    perform set_config('app.trusted', 'off', true);
  end if;
end $$;

create or replace function public._stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'questions', (select count(distinct question_id) from public.student_answers where user_id = p_user),
    'correct_logic', (select count(distinct a.question_id) from public.student_answers a join public.questions q on q.id = a.question_id
                      where a.user_id = p_user and a.is_correct and q.topic = 'penalaran-logis'),
    'correct_algorithm', (select count(distinct a.question_id) from public.student_answers a join public.questions q on q.id = a.question_id
                          where a.user_id = p_user and a.is_correct and q.topic = 'algoritma'),
    'correct_pattern', (select count(distinct a.question_id) from public.student_answers a join public.questions q on q.id = a.question_id
                        where a.user_id = p_user and a.is_correct and q.topic = 'pola'),
    'competitions', (select count(*) from public.competition_results where user_id = p_user),
    'perfect', (select count(*) from public.competition_results where user_id = p_user and unanswered = 0 and incorrect = 0 and correct >= 5),
    'streak', (select longest_streak from public.profiles where id = p_user),
    'daily', (select count(*) from public.xp_events where user_id = p_user and reason = 'daily'),
    'modules', (select count(*) from public.lesson_progress where user_id = p_user and step = 'selesai')
  )
$$;

-- Unlocks every achievement whose threshold is now met. Returns the newly unlocked codes.
create or replace function public._check_achievements(p_user uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := public._stats(p_user);
  a record;
  unlocked text[] := '{}';
  n integer;
begin
  for a in
    select * from public.achievements x
    where not exists (select 1 from public.student_achievements e where e.user_id = p_user and e.achievement_code = x.code)
  loop
    if coalesce((s ->> a.metric)::integer, 0) >= a.threshold then
      insert into public.student_achievements (user_id, achievement_code) values (p_user, a.code)
      on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        unlocked := unlocked || a.code;
        if a.xp_reward > 0 then
          perform public._award_xp(p_user, a.xp_reward, 'achievement', a.code);
        end if;
      end if;
    end if;
  end loop;
  return unlocked;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Practice
-- ---------------------------------------------------------------------------------------------
create or replace function public._require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Kamu harus masuk terlebih dahulu.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = uid and is_active) then
    raise exception 'Akun ini dinonaktifkan. Hubungi admin.' using errcode = '42501';
  end if;
  return uid;
end $$;

create or replace function public.get_daily_challenge() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  today date := public.today_wib();
  qid text;
begin
  select question_id into qid from public.daily_challenges where day = today;
  if qid is null then
    select id into qid from public.questions
    where status = 'published'
      and id not in (select question_id from public.daily_challenges where day > today - 30)
    order by random() limit 1;
    if qid is null then
      select id into qid from public.questions where status = 'published' order by random() limit 1;
    end if;
    if qid is null then
      return null;
    end if;
    insert into public.daily_challenges (day, question_id) values (today, qid) on conflict (day) do nothing;
    select question_id into qid from public.daily_challenges where day = today;
  end if;
  return qid;
end $$;

-- Validates one answer, stores it, and only then reveals the key and explanation.
create or replace function public.submit_answer(
  p_question_id text,
  p_response jsonb,
  p_session_id uuid default null,
  p_mode text default 'bebas',
  p_time_ms integer default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  q public.questions;
  k public.question_keys;
  ok boolean;
  xp integer := 0;
  prior integer;
  prior_correct integer;
  answer_id bigint;
  unlocked text[];
begin
  select * into q from public.questions where id = p_question_id and status = 'published';
  if not found then
    raise exception 'Soal tidak ditemukan.';
  end if;
  if not public._has_response(p_response) then
    raise exception 'Jawaban masih kosong.';
  end if;
  -- A question that is part of a running competition cannot be "peeked" through practice.
  if exists (
    select 1 from public.competition_sessions s
    where s.user_id = uid and s.status = 'in_progress' and p_question_id = any (s.question_ids)
      and (s.deadline is null or s.deadline > now())
  ) then
    raise exception 'Soal ini sedang dipakai dalam simulasi kompetisi yang belum kamu kumpulkan.';
  end if;
  if p_mode not in ('bebas', 'topik', 'tahun', 'acak', 'kesulitan', 'kelemahan', 'kustom', 'modul', 'harian') then
    p_mode := 'bebas';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.practice_sessions where id = p_session_id and user_id = uid and p_question_id = any (question_ids)
  ) then
    p_session_id := null;
  end if;

  select * into k from public.question_keys where question_id = p_question_id;
  ok := public._grade(q.format, k.key, p_response);

  select count(*), count(*) filter (where is_correct) into prior, prior_correct
  from public.student_answers where user_id = uid and question_id = p_question_id;

  insert into public.student_answers (user_id, question_id, session_id, mode, response, is_correct, time_spent_ms)
  values (uid, p_question_id, p_session_id, p_mode, p_response, ok, least(greatest(coalesce(p_time_ms, 0), 0), 3600000))
  returning id into answer_id;

  perform public._touch_activity(uid, 1, ok::integer, least(greatest(coalesce(p_time_ms, 0), 0), 3600000));

  if ok and prior_correct = 0 then
    -- Full XP only on a first-try success; a corrected answer (key already seen) earns a token amount.
    if prior = 0 then
      xp := public._award_xp(uid, public._xp_for(q.difficulty), 'question', p_question_id);
    else
      xp := public._award_xp(uid, 3, 'question', p_question_id);
    end if;
  end if;
  if p_mode = 'harian' and exists (select 1 from public.daily_challenges where day = public.today_wib() and question_id = p_question_id) then
    xp := xp + public._award_xp(uid, 10, 'daily', public.today_wib()::text);
  end if;
  update public.student_answers set xp_awarded = xp where id = answer_id;

  unlocked := public._check_achievements(uid);
  return jsonb_build_object(
    'is_correct', ok,
    'key', k.key,
    'explanation', k.explanation,
    'informatics', k.informatics,
    'xp_awarded', xp,
    'achievements', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'description', description, 'icon', icon)), '[]')
                     from public.achievements where code = any (unlocked))
  );
end $$;

-- Lets a student re-read the key and explanation of a question they have already answered.
create or replace function public.get_review(p_question_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  k public.question_keys;
  last public.student_answers;
begin
  if exists (
    select 1 from public.competition_sessions s
    where s.user_id = uid and s.status = 'in_progress' and p_question_id = any (s.question_ids)
      and (s.deadline is null or s.deadline > now())
  ) then
    return null;
  end if;
  select * into last from public.student_answers
  where user_id = uid and question_id = p_question_id order by created_at desc limit 1;
  if not found then
    return null;
  end if;
  select * into k from public.question_keys where question_id = p_question_id;
  return jsonb_build_object('is_correct', last.is_correct, 'response', last.response, 'key', k.key,
    'explanation', k.explanation, 'informatics', k.informatics, 'answered_at', last.created_at);
end $$;

-- Builds a practice session server-side. p_config: topics[], years[], difficulties[], formats[],
-- only ('unanswered' | 'incorrect' | 'bookmarked'), count, label.
create or replace function public.start_practice(p_mode text, p_config jsonb default '{}') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  n integer := least(greatest(coalesce((p_config ->> 'count')::integer, 10), 1), 40);
  topics text[] := (select array_agg(x) from jsonb_array_elements_text(coalesce(p_config -> 'topics', '[]')) x);
  years integer[] := (select array_agg(x::integer) from jsonb_array_elements_text(coalesce(p_config -> 'years', '[]')) x);
  diffs text[] := (select array_agg(x) from jsonb_array_elements_text(coalesce(p_config -> 'difficulties', '[]')) x);
  formats text[] := (select array_agg(x) from jsonb_array_elements_text(coalesce(p_config -> 'formats', '[]')) x);
  only_filter text := p_config ->> 'only';
  ids text[];
  sid uuid;
begin
  if p_mode not in ('topik', 'tahun', 'acak', 'kesulitan', 'kelemahan', 'kustom', 'modul') then
    raise exception 'Mode latihan tidak dikenal.';
  end if;

  if p_mode = 'kelemahan' then
    -- Weakest topics first (lowest accuracy over the student's own answers), and inside a topic
    -- questions that were never solved correctly come first.
    select array_agg(id) into ids from (
      select q.id
      from public.questions q
      left join lateral (
        select count(*) filter (where a.is_correct)::numeric / nullif(count(*), 0) as acc, count(*) as total
        from public.student_answers a join public.questions q2 on q2.id = a.question_id
        where a.user_id = uid and q2.topic = q.topic
      ) t on true
      where q.status = 'published'
        and not exists (select 1 from public.student_answers a where a.user_id = uid and a.question_id = q.id and a.is_correct)
      order by coalesce(t.acc, 0.5), t.total desc nulls last, random()
      limit n
    ) s;
  else
    select array_agg(id) into ids from (
      select q.id from public.questions q
      where q.status = 'published'
        and (topics is null or q.topic = any (topics))
        and (years is null or q.year = any (years))
        and (diffs is null or q.difficulty = any (diffs))
        and (formats is null or q.format = any (formats))
        and (only_filter is distinct from 'unanswered' or not exists (select 1 from public.student_answers a where a.user_id = uid and a.question_id = q.id))
        and (only_filter is distinct from 'incorrect' or (
              exists (select 1 from public.student_answers a where a.user_id = uid and a.question_id = q.id)
              and not exists (select 1 from public.student_answers a where a.user_id = uid and a.question_id = q.id and a.is_correct)))
        and (only_filter is distinct from 'bookmarked' or exists (select 1 from public.bookmarks b where b.user_id = uid and b.question_id = q.id))
      order by case when p_mode = 'tahun' then q.year * 100 + coalesce(q.number, 0) else 0 end, random()
      limit n
    ) s;
  end if;

  if ids is null then
    raise exception 'Tidak ada soal yang cocok dengan pilihanmu.';
  end if;
  insert into public.practice_sessions (user_id, mode, label, config, question_ids)
  values (uid, p_mode, left(coalesce(p_config ->> 'label', ''), 80), p_config, ids)
  returning id into sid;
  return sid;
end $$;

create or replace function public.update_practice(p_session uuid, p_index integer, p_completed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
begin
  update public.practice_sessions
  set current_index = least(greatest(p_index, 0), cardinality(question_ids) - 1),
      status = case when p_completed then 'completed' else status end,
      completed_at = case when p_completed and completed_at is null then now() else completed_at end
  where id = p_session and user_id = uid;
end $$;

create or replace function public.complete_lesson(p_module text, p_step text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  xp integer := 0;
  unlocked text[];
begin
  if not exists (select 1 from public.topics where slug = p_module) or char_length(p_step) > 40 then
    raise exception 'Modul tidak dikenal.';
  end if;
  if p_step not in ('konsep', 'contoh', 'demo', 'latihan', 'selesai') then
    raise exception 'Langkah modul tidak dikenal.';
  end if;
  -- A module only counts as finished after its four steps and five assessment answers
  -- on authentic questions of that topic.
  if p_step = 'selesai' and (
    (select count(*) from public.lesson_progress where user_id = uid and module = p_module and step in ('konsep', 'contoh', 'demo', 'latihan')) < 4
    or (select count(*) from public.student_answers a join public.questions q on q.id = a.question_id
        where a.user_id = uid and a.mode = 'modul' and q.topic = p_module) < 5
  ) then
    raise exception 'Selesaikan semua langkah modul dan minimal lima soal asesmen terlebih dahulu.';
  end if;
  insert into public.lesson_progress (user_id, module, step) values (uid, p_module, p_step) on conflict do nothing;
  if p_step = 'selesai' then
    xp := public._award_xp(uid, 40, 'lesson', p_module);
  end if;
  unlocked := public._check_achievements(uid);
  return jsonb_build_object('xp_awarded', xp, 'achievements', (
    select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'description', description, 'icon', icon)), '[]')
    from public.achievements where code = any (unlocked)));
end $$;

-- Weekly challenge: answer 20 questions between Monday and Sunday (WIB). Claimable once per week.
create or replace function public.weekly_challenge(p_claim boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  week_start date := date_trunc('week', public.today_wib())::date;
  done integer;
  claimed boolean;
  xp integer := 0;
begin
  select coalesce(sum(questions_answered), 0) into done
  from public.daily_activity where user_id = uid and day >= week_start;
  if p_claim and done >= 20 then
    xp := public._award_xp(uid, 50, 'weekly', week_start::text);
  end if;
  claimed := exists (select 1 from public.xp_events where user_id = uid and reason = 'weekly' and ref = week_start::text);
  return jsonb_build_object('week_start', week_start, 'target', 20, 'progress', done, 'claimed', claimed, 'reward', 50, 'xp_awarded', xp);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Mock competition
-- ---------------------------------------------------------------------------------------------
create or replace function public._finalize_session(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.competition_sessions;
  c public.competitions;
  r record;
  n_correct integer := 0;
  n_wrong integer := 0;
  n_blank integer := 0;
  breakdown jsonb := '{}';
  entry jsonb;
  ok boolean;
  answered boolean;
  spent integer;
  finished timestamptz;
begin
  select * into s from public.competition_sessions where id = p_session for update;
  if not found or s.status = 'submitted' then
    return;
  end if;
  select * into c from public.competitions where id = s.competition_id;
  finished := least(now(), coalesce(s.deadline, now()));
  spent := greatest(extract(epoch from finished - s.started_at)::integer, 0);

  for r in
    select q.id, q.format, q.topic, q.difficulty, k.key, s.answers -> q.id as response
    from unnest(s.question_ids) with ordinality u (qid, ord)
    join public.questions q on q.id = u.qid
    left join public.question_keys k on k.question_id = q.id
    order by u.ord
  loop
    answered := public._has_response(r.response);
    ok := answered and public._grade(r.format, r.key, r.response);
    if not answered then
      n_blank := n_blank + 1;
    elsif ok then
      n_correct := n_correct + 1;
    else
      n_wrong := n_wrong + 1;
    end if;
    entry := coalesce(breakdown -> r.topic, '{"total":0,"correct":0}');
    breakdown := breakdown || jsonb_build_object(r.topic, jsonb_build_object(
      'total', (entry ->> 'total')::integer + 1,
      'correct', (entry ->> 'correct')::integer + ok::integer));
    if answered then
      insert into public.student_answers (user_id, question_id, mode, response, is_correct, time_spent_ms)
      values (s.user_id, r.id, 'kompetisi', r.response, ok, (spent::bigint * 1000 / greatest(cardinality(s.question_ids), 1))::integer);
      if ok and not exists (
        select 1 from public.student_answers a
        where a.user_id = s.user_id and a.question_id = r.id and a.mode <> 'kompetisi'
      ) then
        perform public._award_xp(s.user_id, public._xp_for(r.difficulty), 'question', r.id);
      end if;
    end if;
  end loop;

  insert into public.competition_results (session_id, user_id, competition_id, score, max_score, correct, incorrect, unanswered, accuracy, time_spent_seconds, topic_breakdown)
  values (
    s.id, s.user_id, s.competition_id,
    n_correct * c.score_correct + n_wrong * c.score_wrong + n_blank * c.score_blank,
    cardinality(s.question_ids) * c.score_correct,
    n_correct, n_wrong, n_blank,
    round(100.0 * n_correct / greatest(cardinality(s.question_ids), 1), 1),
    spent, breakdown);
  update public.competition_sessions set status = 'submitted', submitted_at = finished where id = s.id;

  perform public._touch_activity(s.user_id, n_correct + n_wrong, n_correct, spent::bigint * 1000);
  if n_correct + n_wrong > 0 then
    perform public._award_xp(s.user_id, 30, 'competition', s.id::text);
  end if;
  perform public._check_achievements(s.user_id);
end $$;

-- Submits every attempt of the caller whose time has run out (covers closed tabs and lost connections).
create or replace function public.finalize_expired() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  r record;
  n integer := 0;
begin
  for r in
    select id from public.competition_sessions
    where user_id = uid and status = 'in_progress' and deadline is not null and deadline <= now()
  loop
    perform public._finalize_session(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.start_competition(p_competition uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  c public.competitions;
  sid uuid;
  ids text[] := '{}';
  part text[];
  d record;
begin
  perform public.finalize_expired();
  select * into c from public.competitions where id = p_competition and (is_active or public.is_admin());
  if not found then
    raise exception 'Kompetisi tidak ditemukan atau sudah ditutup.';
  end if;
  select id into sid from public.competition_sessions
  where user_id = uid and competition_id = p_competition and status = 'in_progress';
  if sid is not null then
    return sid; -- resume the running attempt
  end if;

  -- Difficulty quotas first, then fill the remaining slots at random.
  for d in select key, value::integer as want from jsonb_each_text(c.difficulty_mix) where value ~ '^\d+$' loop
    select array_agg(id) into part from (
      select q.id from public.questions q
      where q.status = 'published' and q.difficulty = d.key
        and (cardinality(c.topics) = 0 or q.topic = any (c.topics))
        and (cardinality(c.years) = 0 or q.year = any (c.years))
      order by random() limit least(d.want, c.question_count - cardinality(ids))
    ) x;
    ids := ids || coalesce(part, '{}');
  end loop;
  if cardinality(ids) < c.question_count then
    select array_agg(id) into part from (
      select q.id from public.questions q
      where q.status = 'published' and not (q.id = any (ids))
        and (cardinality(c.topics) = 0 or q.topic = any (c.topics))
        and (cardinality(c.years) = 0 or q.year = any (c.years))
      order by random() limit c.question_count - cardinality(ids)
    ) x;
    ids := ids || coalesce(part, '{}');
  end if;
  if cardinality(ids) = 0 then
    raise exception 'Belum ada soal yang memenuhi aturan kompetisi ini.';
  end if;
  select array_agg(x order by random()) into ids from unnest(ids) x;

  insert into public.competition_sessions (competition_id, user_id, question_ids, deadline)
  values (p_competition, uid, ids, case when c.mode = 'latihan' or c.duration_minutes is null then null
                                        else now() + make_interval(mins => c.duration_minutes) end)
  on conflict (user_id, competition_id) where status = 'in_progress' do nothing
  returning id into sid;
  if sid is null then
    select id into sid from public.competition_sessions
    where user_id = uid and competition_id = p_competition and status = 'in_progress';
  end if;
  return sid;
end $$;

-- Autosave for one answer. Rejected once the time is up or the attempt has been submitted.
create or replace function public.save_competition_answer(p_session uuid, p_question text, p_response jsonb, p_marked boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  s public.competition_sessions;
begin
  select * into s from public.competition_sessions where id = p_session and user_id = uid for update;
  if not found then
    raise exception 'Sesi tidak ditemukan.';
  end if;
  if s.status = 'submitted' then
    return jsonb_build_object('saved', false, 'reason', 'submitted');
  end if;
  if s.deadline is not null and now() > s.deadline + interval '3 seconds' then
    perform public._finalize_session(s.id);
    return jsonb_build_object('saved', false, 'reason', 'expired');
  end if;
  if not (p_question = any (s.question_ids)) then
    raise exception 'Soal bukan bagian dari sesi ini.';
  end if;
  update public.competition_sessions
  set answers = case when public._has_response(p_response) then answers || jsonb_build_object(p_question, p_response)
                     else answers - p_question end,
      marked = case when p_marked is null then marked
                    when p_marked then (select array_agg(distinct x) from unnest(marked || p_question) x)
                    else array_remove(marked, p_question) end
  where id = s.id;
  return jsonb_build_object('saved', true);
end $$;

-- The countdown is driven by the server clock, so a wrong device clock cannot add time.
create or replace function public.server_time() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

-- Idempotent: a second call (double click, refresh, auto-submit racing a manual submit) is a no-op.
create or replace function public.submit_competition(p_session uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
begin
  if not exists (select 1 from public.competition_sessions where id = p_session and user_id = uid) then
    raise exception 'Sesi tidak ditemukan.';
  end if;
  perform public._finalize_session(p_session);
  return p_session;
end $$;

-- Full review (keys + explanations), only after the attempt has been submitted.
create or replace function public.get_competition_review(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := public._require_user();
  s public.competition_sessions;
begin
  select * into s from public.competition_sessions
  where id = p_session and (user_id = uid or public.is_admin()) and status = 'submitted';
  if not found then
    return null;
  end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'question_id', q.id,
      'response', s.answers -> q.id,
      'is_correct', public._has_response(s.answers -> q.id) and public._grade(q.format, k.key, s.answers -> q.id),
      'answered', public._has_response(s.answers -> q.id),
      'key', k.key, 'explanation', k.explanation, 'informatics', k.informatics) order by u.ord)
    from unnest(s.question_ids) with ordinality u (qid, ord)
    join public.questions q on q.id = u.qid
    left join public.question_keys k on k.question_id = q.id
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- Leaderboard & public numbers
-- ---------------------------------------------------------------------------------------------
-- Real rows only, aggregated from xp_events. Students who hide themselves are skipped for
-- everybody else; names shown are usernames, never full names.
create or replace function public.leaderboard(p_period text default 'weekly')
returns table (rank bigint, user_id uuid, username text, avatar_url text, grade smallint, xp bigint, best_score numeric, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with since as (
    select case p_period
      when 'weekly' then (date_trunc('week', public.today_wib())::timestamp at time zone 'Asia/Jakarta')
      when 'monthly' then (date_trunc('month', public.today_wib())::timestamp at time zone 'Asia/Jakarta')
      else '-infinity'::timestamptz end as t
  ),
  totals as (
    select e.user_id, sum(e.amount) as xp from public.xp_events e, since where e.created_at >= since.t group by e.user_id
  )
  select row_number() over (order by t.xp desc, p.username) as rank, p.id, p.username::text, p.avatar_url, p.grade, t.xp,
    (select max(r.accuracy) from public.competition_results r, since where r.user_id = p.id and r.created_at >= since.t) as best_score,
    p.id = (select auth.uid()) as is_me
  from totals t
  join public.profiles p on p.id = t.user_id
  where (select auth.uid()) is not null and p.is_active and p.role = 'student'
    and (p.leaderboard_visible or p.id = (select auth.uid()))
  order by t.xp desc, p.username
  limit 100
$$;

-- Numbers for the landing page (visible without login). Counts only, no personal data.
create or replace function public.public_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'questions', (select count(*) from public.questions where status = 'published' and origin = 'historical'),
    'years', (select coalesce(jsonb_agg(y order by y), '[]') from (select distinct year as y from public.questions where status = 'published' and year is not null) s),
    'topics', (select count(*) from public.topics))
$$;

-- ---------------------------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------------------------
create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Khusus administrator.' using errcode = '42501';
  end if;
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'active_today', (select count(*) from public.daily_activity where day = public.today_wib()),
    'answers', (select count(*) from public.student_answers),
    'accuracy', (select round(100.0 * count(*) filter (where is_correct) / nullif(count(*), 0), 1) from public.student_answers),
    'topics', (select coalesce(jsonb_agg(jsonb_build_object('topic', t.slug, 'name', t.name, 'answers', s.n, 'accuracy', s.acc) order by s.n desc nulls last), '[]')
               from public.topics t left join lateral (
                 select count(*) as n, round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*), 0), 1) as acc
                 from public.student_answers a join public.questions q on q.id = a.question_id where q.topic = t.slug) s on true),
    'competition_attempts', (select count(*) from public.competition_results),
    'competition_students', (select count(distinct user_id) from public.competition_results),
    'questions_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) as n from public.questions group by status) s)
  );
end $$;

create or replace function public.admin_students()
returns table (id uuid, username text, full_name text, grade smallint, role text, is_active boolean, xp integer, streak integer,
               last_active date, created_at timestamptz, answers bigint, accuracy numeric, competitions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
  select p.id, p.username::text, p.full_name, p.grade, p.role, p.is_active, p.xp, p.streak, p.last_active, p.created_at,
    (select count(*) from public.student_answers a where a.user_id = p.id),
    (select round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*), 0), 1) from public.student_answers a where a.user_id = p.id),
    (select count(*) from public.competition_results r where r.user_id = p.id)
  from public.profiles p order by p.created_at desc;
end $$;

-- Imports extracted questions. p_trust = false (the admin UI) always lands in "needs_review":
-- nothing extracted from a PDF is published without a human approving it.
create or replace function public._import_questions(p_payload jsonb, p_trust boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  src record;
  q jsonb;
  o jsonb;
  sid integer;
  n integer := 0;
  ord integer;
  target text;
begin
  for src in select key, value from jsonb_each(coalesce(p_payload -> 'sources', '{}')) loop
    insert into public.question_sources (year, title, license, file_name)
    values (src.key::integer, src.value ->> 'title', src.value ->> 'license', src.value ->> 'file')
    on conflict (year) do update set title = excluded.title, license = excluded.license, file_name = excluded.file_name;
  end loop;

  for q in select * from jsonb_array_elements(p_payload -> 'questions') loop
    select id into sid from public.question_sources where year = (q ->> 'year')::integer;
    target := case when p_trust and q ->> 'status' = 'published' then 'published' else 'needs_review' end;
    insert into public.questions (id, origin, source_id, year, number, code, code_note, title, country, category, topic, difficulty,
                                  format, stem, input_hint, original, pages, credit, status, review_note)
    values (
      q ->> 'id', 'historical', sid, (q ->> 'year')::integer, (q ->> 'number')::integer, q ->> 'code', q ->> 'code_note',
      q ->> 'title', q ->> 'country', coalesce(q ->> 'category', 'Penggalang (SMP)'), q ->> 'topic', q ->> 'difficulty', q ->> 'format',
      coalesce(q -> 'stem', '[]'), q ->> 'input_hint', coalesce(q -> 'original', '[]'),
      (select coalesce(array_agg(x::integer), '{}') from jsonb_array_elements_text(coalesce(q -> 'source' -> 'pages', '[]')) x),
      q ->> 'credit', 'needs_review', q ->> 'review_note')
    on conflict (id) do update set
      source_id = excluded.source_id, year = excluded.year, number = excluded.number, code = excluded.code, code_note = excluded.code_note,
      title = excluded.title, country = excluded.country, topic = excluded.topic, difficulty = excluded.difficulty, format = excluded.format,
      stem = excluded.stem, input_hint = excluded.input_hint, original = excluded.original, pages = excluded.pages,
      credit = excluded.credit, status = 'needs_review', review_note = excluded.review_note;

    delete from public.question_options where question_id = q ->> 'id';
    ord := 0;
    for o in select * from jsonb_array_elements(coalesce(q -> 'options', '[]')) loop
      ord := ord + 1;
      insert into public.question_options (question_id, label, text, image, sort)
      values (q ->> 'id', o ->> 'label', coalesce(o ->> 'text', ''), o -> 'image', ord);
    end loop;

    insert into public.question_keys (question_id, key, explanation, informatics)
    values (q ->> 'id', nullif(q -> 'key', 'null'), coalesce(q -> 'explanation', '[]'), coalesce(q -> 'informatics', '[]'))
    on conflict (question_id) do update set key = excluded.key, explanation = excluded.explanation, informatics = excluded.informatics;

    if target = 'published' then
      update public.questions set status = 'published' where id = q ->> 'id';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.import_questions(p_payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return public._import_questions(p_payload, false);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: internal helpers are not callable through the API.
-- ---------------------------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.public_stats() to anon, authenticated;
grant execute on function public.is_admin(), public.is_active_user(), public.today_wib(), public.server_time() to authenticated;
grant execute on function
  public.get_daily_challenge(), public.submit_answer(text, jsonb, uuid, text, integer), public.get_review(text),
  public.start_practice(text, jsonb), public.update_practice(uuid, integer, boolean), public.complete_lesson(text, text),
  public.weekly_challenge(boolean), public.finalize_expired(), public.start_competition(uuid),
  public.save_competition_answer(uuid, text, jsonb, boolean), public.submit_competition(uuid),
  public.get_competition_review(uuid), public.leaderboard(text), public.admin_stats(), public.admin_students(),
  public.import_questions(jsonb)
to authenticated;
revoke execute on function
  public._grade(text, jsonb, jsonb), public._has_response(jsonb), public._xp_for(text), public._award_xp(uuid, integer, text, text),
  public._touch_activity(uuid, integer, integer, bigint), public._stats(uuid), public._check_achievements(uuid),
  public._require_user(), public._require_admin(), public._finalize_session(uuid), public._import_questions(jsonb, boolean),
  public.handle_new_user(), public.protect_profile(), public.guard_publish()
from authenticated;
