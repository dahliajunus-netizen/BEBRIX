"use client";

import { BarChart3, BookOpen, CalendarCheck, CheckCircle2, Clock, Flag, Flame, GraduationCap, Library, Medal, PlayCircle, Sparkles, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar, Badge, Button, ButtonLink, Card, Notice, Progress, Spinner, Stat } from "@/components/ui";
import { MODULE_ORDER } from "@/content/modules";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { QuestionSummary } from "@/lib/types";
import { cn, DIFFICULTY_NAMES, formatDuration, levelInfo, MODE_NAMES, percent, todayWib, TOPIC_NAMES } from "@/lib/utils";

interface Day { day: string; questions_answered: number; correct: number; time_spent_ms: number; xp_earned: number }
interface Weekly { target: number; progress: number; claimed: boolean; reward: number }

const QUICK = [
  { href: "/latihan", label: "Latihan", icon: BookOpen },
  { href: "/belajar", label: "Belajar", icon: GraduationCap },
  { href: "/kompetisi", label: "Simulasi Kompetisi", icon: Flag },
  { href: "/bank-soal", label: "Bank Soal", icon: Library },
  { href: "/analitik", label: "Analitik", icon: BarChart3 },
  { href: "/papan-peringkat", label: "Papan Peringkat", icon: Trophy },
  { href: "/pencapaian", label: "Pencapaian", icon: Medal },
];

/** Encouragement derived from the student's real activity, never a random quote. */
function message(streak: number, answeredToday: number, total: number) {
  if (total === 0) return "Selamat datang. Mulai dari tantangan harian untuk mengenal bentuk soal Bebras.";
  if (answeredToday === 0 && streak > 0) return `Runtunmu sudah ${streak} hari. Kerjakan satu soal hari ini agar tidak terputus.`;
  if (answeredToday > 0) return `Kamu sudah mengerjakan ${answeredToday} soal hari ini. Konsistensi seperti ini yang membuat kemampuanmu naik.`;
  return "Runtunmu terputus, tidak apa-apa. Satu soal hari ini cukup untuk memulainya lagi.";
}

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const uid = profile!.id;
  const today = todayWib();
  const [claiming, setClaiming] = useState(false);

  const { data, loading, error, reload } = useQuery(async () => {
    const sb = supabase();
    await sb.rpc("finalize_expired");
    const [days, dailyId, weekly, session, comp, lessons] = await Promise.all([
      sb.from("daily_activity").select("*").eq("user_id", uid).order("day"),
      sb.rpc("get_daily_challenge"),
      sb.rpc("weekly_challenge", { p_claim: false }),
      sb.from("practice_sessions").select("id, mode, label, question_ids, current_index, started_at").eq("user_id", uid).eq("status", "active").order("started_at", { ascending: false }).limit(1),
      sb.from("competition_sessions").select("id, competition_id, deadline, competitions(title)").eq("user_id", uid).eq("status", "in_progress").limit(1),
      sb.from("lesson_progress").select("module, step").eq("user_id", uid),
    ]);
    const qid = unwrap(dailyId) as string | null;
    let daily: QuestionSummary | null = null;
    let dailyDone = false;
    if (qid) {
      const [q, a] = await Promise.all([
        sb.from("questions").select("id, year, number, code, title, topic, difficulty, format, origin, status").eq("id", qid).maybeSingle(),
        sb.from("student_answers").select("id").eq("user_id", uid).eq("question_id", qid).eq("mode", "harian").gte("created_at", `${today}T00:00:00+07:00`).limit(1),
      ]);
      daily = q.data as QuestionSummary | null;
      dailyDone = (a.data?.length ?? 0) > 0;
    }
    return {
      days: unwrap(days) as Day[],
      daily, dailyDone,
      weekly: unwrap(weekly) as Weekly,
      session: unwrap(session)[0] as { id: string; mode: string; label: string; question_ids: string[]; current_index: number } | undefined,
      comp: unwrap(comp)[0] as unknown as { id: string; competitions: { title: string } } | undefined,
      lessons: unwrap(lessons) as { module: string; step: string }[],
    };
  }, [uid]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <Notice tone="bad" title="Dasbor gagal dimuat">{error}</Notice>;

  const lv = levelInfo(profile!.xp);
  const total = data.days.reduce((s, d) => s + d.questions_answered, 0);
  const correct = data.days.reduce((s, d) => s + d.correct, 0);
  const time = data.days.reduce((s, d) => s + Number(d.time_spent_ms), 0) / 1000;
  const byDay = new Map(data.days.map((d) => [d.day, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = todayWib(i - 6);
    return { day, n: byDay.get(day)?.questions_answered ?? 0 };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.n));
  const answeredToday = byDay.get(today)?.questions_answered ?? 0;
  const doneModules = new Set(data.lessons.filter((l) => l.step === "selesai").map((l) => l.module));
  const nextModule = MODULE_ORDER.find((m) => !doneModules.has(m));

  const claim = async () => {
    setClaiming(true);
    await supabase().rpc("weekly_challenge", { p_claim: true });
    await Promise.all([reload(), refreshProfile()]);
    setClaiming(false);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-navy-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar url={profile!.avatar_url} name={profile!.username} size={60} />
            <div>
              <h1 className="text-2xl font-bold">Halo, {profile!.full_name?.split(" ")[0] || profile!.username}</h1>
              <p className="text-sm text-white/65">{profile!.grade ? `Kelas ${profile!.grade} · ` : ""}@{profile!.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
            <Flame className={cn("size-7", profile!.streak > 0 ? "text-cyan-500" : "text-white/40")} />
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">{profile!.streak} hari</p>
              <p className="mt-1 text-xs text-white/65">runtun belajar · terpanjang {profile!.longest_streak}</p>
            </div>
          </div>
        </div>
        <p className="px-6 py-4 text-sm text-muted">{message(profile!.streak, answeredToday, total)}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Soal dijawab" value={total} hint={`${answeredToday} hari ini`} icon={<Target className="size-4" />} />
        <Stat label="Akurasi" value={total ? `${percent(correct, total)}%` : "–"} hint={total ? `${correct} benar dari ${total}` : "Belum ada jawaban"} icon={<CheckCircle2 className="size-4" />} />
        <Stat label="Waktu latihan" value={time ? formatDuration(time) : "–"} hint="Total sejak bergabung" icon={<Clock className="size-4" />} />
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-faint">Level {lv.level}</p><Sparkles className="size-4 text-brand-600" /></div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy-900">{profile!.xp} XP</p>
          <Progress value={lv.progress * 100} className="mt-2" />
          <p className="mt-1 text-xs text-muted">{lv.next - profile!.xp} XP lagi ke level {lv.level + 1}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><PlayCircle className="size-5 text-brand-600" />Lanjutkan belajar</h2>
          <div className="mt-4 space-y-3">
            {data.comp && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-50 bg-warn-50 p-4">
                <div><p className="font-semibold text-ink">{data.comp.competitions.title}</p><p className="text-sm text-muted">Simulasi kompetisi sedang berjalan dan belum dikumpulkan.</p></div>
                <ButtonLink href={`/kompetisi/sesi?id=${data.comp.id}`}>Lanjutkan</ButtonLink>
              </div>
            )}
            {data.session && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{data.session.label || MODE_NAMES[data.session.mode]}</p>
                  <p className="text-sm text-muted">Soal {data.session.current_index + 1} dari {data.session.question_ids.length}</p>
                  <Progress value={percent(data.session.current_index, data.session.question_ids.length)} className="mt-2 max-w-xs" />
                </div>
                <ButtonLink href={`/latihan/sesi?id=${data.session.id}`}>Lanjutkan</ButtonLink>
              </div>
            )}
            {nextModule && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
                <div><p className="font-semibold text-ink">Modul {TOPIC_NAMES[nextModule]}</p><p className="text-sm text-muted">{doneModules.size} dari {MODULE_ORDER.length} modul selesai</p></div>
                <ButtonLink href={`/belajar/modul?m=${nextModule}`} variant="secondary">Buka modul</ButtonLink>
              </div>
            )}
            {!data.comp && !data.session && !nextModule && <p className="text-sm text-muted">Tidak ada sesi yang tertunda. Mulai latihan baru dari menu Latihan.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><CalendarCheck className="size-5 text-cyan-600" />Tantangan harian</h2>
          {data.daily ? (
            <div className="mt-4">
              <p className="font-semibold text-ink">{data.daily.title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="brand">Bebras {data.daily.year}</Badge>
                <Badge tone="cyan">{TOPIC_NAMES[data.daily.topic]}</Badge>
                <Badge>{DIFFICULTY_NAMES[data.daily.difficulty]}</Badge>
              </div>
              {data.dailyDone ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><CheckCircle2 className="size-4" />Sudah dikerjakan hari ini</p>
              ) : (
                <p className="mt-4 text-sm text-muted">Bonus +10 XP untuk menyelesaikannya hari ini.</p>
              )}
              <ButtonLink href={`/soal?id=${data.daily.id}&mode=harian`} variant={data.dailyDone ? "secondary" : "primary"} className="mt-3 w-full">{data.dailyDone ? "Lihat lagi" : "Kerjakan"}</ButtonLink>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Belum ada soal terbit di bank soal.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-bold text-navy-900">Aktivitas 7 hari terakhir</h2>
          <div className="mt-5 flex h-36 items-end gap-2 sm:gap-4" role="img" aria-label={`Jumlah soal per hari: ${week.map((w) => w.n).join(", ")}`}>
            {week.map((w) => (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-muted">{w.n || ""}</span>
                <div className={cn("w-full max-w-12 rounded-t-md", w.n ? "bg-brand-600" : "bg-line")} style={{ height: `${Math.max(4, (w.n / weekMax) * 96)}px` }} />
                <span className={cn("text-xs", w.day === today ? "font-bold text-navy-900" : "text-faint")}>
                  {new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${w.day}T12:00:00+07:00`))}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Tantangan mingguan</h2>
          <p className="mt-1 text-sm text-muted">Kerjakan {data.weekly.target} soal antara Senin dan Minggu.</p>
          <Progress value={percent(Math.min(data.weekly.progress, data.weekly.target), data.weekly.target)} tone="cyan" className="mt-4" />
          <p className="mt-2 text-sm font-semibold tabular-nums text-ink">{Math.min(data.weekly.progress, data.weekly.target)} / {data.weekly.target} soal</p>
          {data.weekly.claimed ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><CheckCircle2 className="size-4" />Hadiah +{data.weekly.reward} XP sudah diklaim</p>
          ) : (
            <Button className="mt-3 w-full" variant={data.weekly.progress >= data.weekly.target ? "primary" : "secondary"} disabled={data.weekly.progress < data.weekly.target} loading={claiming} onClick={claim}>
              Klaim +{data.weekly.reward} XP
            </Button>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-bold text-navy-900">Navigasi cepat</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {QUICK.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center text-sm font-semibold text-navy-900 shadow-card hover:border-brand-500">
              <Icon className="size-5 text-brand-600" />{label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
