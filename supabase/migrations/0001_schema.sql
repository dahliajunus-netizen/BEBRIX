-- BEBRIX schema: tables, indexes, row level security.
-- Answer keys live in question_keys, which students can never read directly:
-- every validation goes through the SECURITY DEFINER functions in 0002_functions.sql.

create extension if not exists citext;

create or replace function public.today_wib() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ---------------------------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  full_name text not null default '' check (char_length(full_name) <= 80),
  grade smallint check (grade between 7 and 9),
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'admin')),
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active date,
  leaderboard_visible boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and is_active)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active)
$$;

-- Students may edit their own profile, but never role, XP, streak or access flags.
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or public.is_admin() or current_setting('app.trusted', true) = 'on' then
    return new;
  end if;
  new.id := old.id;
  new.role := old.role;
  new.xp := old.xp;
  new.streak := old.streak;
  new.longest_streak := old.longest_streak;
  new.last_active := old.last_active;
  new.is_active := old.is_active;
  new.created_at := old.created_at;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
for each row execute function public.protect_profile();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  n integer := 0;
  g text := new.raw_user_meta_data ->> 'grade';
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), ''), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'siswa' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 16) || n::text;
  end loop;
  insert into public.profiles (id, username, full_name, grade)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
    case when g in ('7', '8', '9') then g::smallint end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------------------------
create table public.topics (
  slug text primary key,
  name text not null,
  description text not null,
  sort smallint not null default 0
);

create table public.question_sources (
  id serial primary key,
  year integer not null unique,
  title text not null,
  license text not null,
  file_name text,
  attribution text not null default 'Bebras Indonesia (bebras.or.id) dan komunitas Bebras internasional'
);

create table public.questions (
  id text primary key,
  origin text not null default 'historical' check (origin in ('historical', 'original')),
  source_id integer references public.question_sources (id) on delete set null,
  year integer,
  number integer,
  code text,
  code_note text,
  title text not null,
  country text,
  category text not null default 'Penggalang (SMP)',
  topic text not null references public.topics (slug),
  difficulty text not null check (difficulty in ('mudah', 'sedang', 'sulit', 'lanjutan')),
  format text not null check (format in ('single_choice', 'multiple_choice', 'short_answer', 'ordering', 'grid_select')),
  stem jsonb not null default '[]',
  config jsonb not null default '{}',
  input_hint text,
  original jsonb not null default '[]',
  pages integer[] not null default '{}',
  credit text,
  status text not null default 'needs_review' check (status in ('draft', 'needs_review', 'published', 'archived')),
  review_note text,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin = 'original' or (year is not null and source_id is not null))
);
create index questions_filter_idx on public.questions (status, year, topic, difficulty);
create index questions_topic_idx on public.questions (topic);
create index questions_source_idx on public.questions (source_id);
create index questions_search_idx on public.questions using gin (to_tsvector('simple', search_text));

create table public.question_options (
  question_id text not null references public.questions (id) on delete cascade,
  label text not null,
  text text not null default '',
  image jsonb,
  sort smallint not null default 0,
  primary key (question_id, label)
);

-- Answer key + explanations. No student policy: readable only through functions.
create table public.question_keys (
  question_id text primary key references public.questions (id) on delete cascade,
  key jsonb,
  explanation jsonb not null default '[]',
  informatics jsonb not null default '[]'
);

create table public.question_assets (
  id bigserial primary key,
  question_id text not null references public.questions (id) on delete cascade,
  path text not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);
create index question_assets_question_idx on public.question_assets (question_id);

-- A question can only be published with a verified key and enough answer options.
create or replace function public.guard_publish() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.search_text := coalesce(new.title, '') || ' ' || coalesce(new.code, '') || ' ' ||
    coalesce((select string_agg(b ->> 'text', ' ') from jsonb_array_elements(new.stem) b where b ? 'text'), '');
  if new.status = 'published' then
    if not exists (
      select 1 from public.question_keys k
      where k.question_id = new.id and k.key is not null and coalesce((k.key ->> 'proposed')::boolean, false) = false
    ) then
      raise exception 'Soal % belum memiliki kunci jawaban terverifikasi.', new.id;
    end if;
    if new.format in ('single_choice', 'multiple_choice', 'ordering')
       and (select count(*) from public.question_options o where o.question_id = new.id) < 2 then
      raise exception 'Soal % membutuhkan minimal dua pilihan jawaban.', new.id;
    end if;
  end if;
  return new;
end $$;

create trigger questions_guard before insert or update on public.questions
for each row execute function public.guard_publish();

-- ---------------------------------------------------------------------------------------------
-- Student activity
-- ---------------------------------------------------------------------------------------------
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('topik', 'tahun', 'acak', 'kesulitan', 'kelemahan', 'kustom', 'modul')),
  label text not null default '',
  config jsonb not null default '{}',
  question_ids text[] not null,
  current_index integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, status, started_at desc);

create table public.student_answers (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  session_id uuid references public.practice_sessions (id) on delete set null,
  mode text not null,
  response jsonb not null,
  is_correct boolean not null,
  time_spent_ms integer not null default 0,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now()
);
create index student_answers_user_idx on public.student_answers (user_id, created_at desc);
create index student_answers_user_question_idx on public.student_answers (user_id, question_id);
create index student_answers_question_idx on public.student_answers (question_id);
create index student_answers_session_idx on public.student_answers (session_id);

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index bookmarks_question_idx on public.bookmarks (question_id);

create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  questions_answered integer not null default 0,
  correct integer not null default 0,
  time_spent_ms bigint not null default 0,
  xp_earned integer not null default 0,
  primary key (user_id, day)
);

create table public.daily_challenges (
  day date primary key,
  question_id text not null references public.questions (id) on delete cascade
);
create index daily_challenges_question_idx on public.daily_challenges (question_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null references public.topics (slug),
  step text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, module, step)
);

-- Every XP grant is one row; the unique key makes each reward claimable exactly once.
-- The leaderboard (weekly / monthly / all-time) is aggregated from this table.
create table public.xp_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index xp_events_created_idx on public.xp_events (created_at, user_id);

create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null default 'award',
  metric text not null,
  threshold integer not null,
  xp_reward integer not null default 0,
  sort smallint not null default 0
);

create table public.student_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);
create index student_achievements_code_idx on public.student_achievements (achievement_code);

-- ---------------------------------------------------------------------------------------------
-- Mock competitions
-- ---------------------------------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  mode text not null check (mode in ('latihan', 'berwaktu', 'penuh')),
  duration_minutes integer check (duration_minutes between 1 and 300),
  question_count integer not null check (question_count between 1 and 60),
  difficulty_mix jsonb not null default '{}',
  topics text[] not null default '{}',
  years integer[] not null default '{}',
  score_correct numeric not null default 4,
  score_wrong numeric not null default 0,
  score_blank numeric not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (mode = 'latihan' or duration_minutes is not null)
);
create index competitions_creator_idx on public.competitions (created_by);

create table public.competition_sessions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_ids text[] not null,
  answers jsonb not null default '{}',
  marked text[] not null default '{}',
  started_at timestamptz not null default now(),
  deadline timestamptz,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted'))
);
create index competition_sessions_user_idx on public.competition_sessions (user_id, status);
create index competition_sessions_competition_idx on public.competition_sessions (competition_id);
-- One running attempt per student and competition: blocks duplicate starts.
create unique index competition_sessions_one_running on public.competition_sessions (user_id, competition_id) where status = 'in_progress';

create table public.competition_results (
  session_id uuid primary key references public.competition_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  score numeric not null,
  max_score numeric not null,
  correct integer not null,
  incorrect integer not null,
  unanswered integer not null,
  accuracy numeric not null,
  time_spent_seconds integer not null,
  topic_breakdown jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index competition_results_user_idx on public.competition_results (user_id, created_at desc);
create index competition_results_competition_idx on public.competition_results (competition_id);

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.question_sources enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_keys enable row level security;
alter table public.question_assets enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.student_answers enable row level security;
alter table public.bookmarks enable row level security;
alter table public.daily_activity enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.xp_events enable row level security;
alter table public.achievements enable row level security;
alter table public.student_achievements enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_sessions enable row level security;
alter table public.competition_results enable row level security;

-- Profiles: own row, or everything for admins. Other students are only visible through leaderboard().
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Reference data.
create policy topics_read on public.topics for select to authenticated using (true);
create policy topics_admin on public.topics for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sources_read on public.question_sources for select to authenticated using (true);
create policy sources_admin on public.question_sources for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy achievements_read on public.achievements for select to authenticated using (true);
create policy achievements_admin on public.achievements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Questions: students see published questions only; keys are admin-only.
create policy questions_read on public.questions for select to authenticated
  using ((status = 'published' and (select public.is_active_user())) or (select public.is_admin()));
create policy questions_admin_insert on public.questions for insert to authenticated with check ((select public.is_admin()));
create policy questions_admin_update on public.questions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy questions_admin_delete on public.questions for delete to authenticated using ((select public.is_admin()));

create policy options_read on public.question_options for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy options_admin_insert on public.question_options for insert to authenticated with check ((select public.is_admin()));
create policy options_admin_update on public.question_options for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy options_admin_delete on public.question_options for delete to authenticated using ((select public.is_admin()));

create policy keys_admin on public.question_keys for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy assets_read on public.question_assets for select to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id));
create policy assets_admin_insert on public.question_assets for insert to authenticated with check ((select public.is_admin()));
create policy assets_admin_delete on public.question_assets for delete to authenticated using ((select public.is_admin()));

-- Student records: read your own; writes happen inside validated functions.
create policy practice_select on public.practice_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy answers_select on public.student_answers for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy activity_select on public.daily_activity for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy xp_select on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy earned_select on public.student_achievements for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy lessons_select on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy daily_read on public.daily_challenges for select to authenticated using (true);

create policy bookmarks_select on public.bookmarks for select to authenticated using (user_id = (select auth.uid()));
create policy bookmarks_insert on public.bookmarks for insert to authenticated with check (user_id = (select auth.uid()));
create policy bookmarks_delete on public.bookmarks for delete to authenticated using (user_id = (select auth.uid()));

-- Competitions.
create policy competitions_read on public.competitions for select to authenticated
  using (is_active or (select public.is_admin()));
create policy competitions_admin_insert on public.competitions for insert to authenticated with check ((select public.is_admin()));
create policy competitions_admin_update on public.competitions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy competitions_admin_delete on public.competitions for delete to authenticated using ((select public.is_admin()));
create policy comp_sessions_select on public.competition_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy comp_results_select on public.competition_results for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Storage: profile pictures (owner-writable) and question diagrams (admin-writable)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp']),
  ('question-assets', 'question-assets', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('source-books', 'source-books', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy assets_admin_write on storage.objects for insert to authenticated
  with check (bucket_id in ('question-assets', 'source-books') and (select public.is_admin()));
create policy assets_admin_change on storage.objects for update to authenticated
  using (bucket_id in ('question-assets', 'source-books') and (select public.is_admin()));
create policy assets_admin_remove on storage.objects for delete to authenticated
  using (bucket_id in ('question-assets', 'source-books') and (select public.is_admin()));
create policy books_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'source-books' and (select public.is_admin()));
