"use client";

import { Award, Brain, CalendarCheck, Flag, Flame, GraduationCap, Layers, Library, Lock, Medal, Shapes, Sparkles, Target, Trophy, Workflow, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Card, Notice, PageHeader, Progress, Spinner, Stat } from "@/components/ui";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { cn, formatDate, levelInfo, percent } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, target: Target, layers: Layers, library: Library, brain: Brain, workflow: Workflow, shapes: Shapes,
  flame: Flame, "calendar-check": CalendarCheck, flag: Flag, trophy: Trophy, medal: Medal, "graduation-cap": GraduationCap,
};
interface Achievement { code: string; name: string; description: string; icon: string; metric: string; threshold: number; xp_reward: number }

export default function Achievements() {
  const { profile } = useAuth();
  const uid = profile!.id;
  const { data, loading, error } = useQuery(async () => {
    const sb = supabase();
    const [all, earned, answers, results, daily, lessons, xp] = await Promise.all([
      sb.from("achievements").select("*").order("sort"),
      sb.from("student_achievements").select("achievement_code, earned_at").eq("user_id", uid),
      sb.from("student_answers").select("question_id, is_correct, questions(topic)").eq("user_id", uid),
      sb.from("competition_results").select("correct, incorrect, unanswered, accuracy, score").eq("user_id", uid),
      sb.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("reason", "daily"),
      sb.from("lesson_progress").select("module").eq("user_id", uid).eq("step", "selesai"),
      sb.from("daily_activity").select("day, questions_answered, xp_earned").eq("user_id", uid),
    ]);
    const rows = unwrap(answers) as unknown as { question_id: string; is_correct: boolean; questions: { topic: string } }[];
    const distinctCorrect = (topic: string) => new Set(rows.filter((a) => a.is_correct && a.questions?.topic === topic).map((a) => a.question_id)).size;
    const res = unwrap(results) as { correct: number; incorrect: number; unanswered: number; accuracy: number; score: number }[];
    const days = unwrap(xp) as { day: string; questions_answered: number; xp_earned: number }[];
    // Mirrors public._stats() so progress bars match what the server will unlock.
    const stats: Record<string, number> = {
      questions: new Set(rows.map((a) => a.question_id)).size,
      correct_logic: distinctCorrect("penalaran-logis"), correct_algorithm: distinctCorrect("algoritma"), correct_pattern: distinctCorrect("pola"),
      competitions: res.length, perfect: res.filter((r) => r.unanswered === 0 && r.incorrect === 0 && r.correct >= 5).length,
      streak: profile!.longest_streak, daily: daily.count ?? 0, modules: (unwrap(lessons) as unknown[]).length,
    };
    return {
      all: unwrap(all) as Achievement[],
      earned: new Map((unwrap(earned) as { achievement_code: string; earned_at: string }[]).map((e) => [e.achievement_code, e.earned_at])),
      stats,
      records: {
        bestDay: days.reduce((m, d) => Math.max(m, d.questions_answered), 0),
        bestXpDay: days.reduce((m, d) => Math.max(m, d.xp_earned), 0),
        bestAccuracy: res.reduce((m, r) => Math.max(m, Number(r.accuracy)), 0),
        activeDays: days.filter((d) => d.questions_answered > 0).length,
      },
    };
  }, [uid, profile!.longest_streak]);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <Notice tone="bad" title="Pencapaian gagal dimuat">{error}</Notice>;
  const lv = levelInfo(profile!.xp);

  return (
    <div>
      <PageHeader title="Pencapaian" description="Lencana terbuka otomatis saat syaratnya terpenuhi. Setiap lencana hanya bisa diperoleh satu kali." />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-faint">Level saat ini</p><p className="text-3xl font-extrabold text-navy-900">Level {lv.level}</p></div>
          <p className="text-sm tabular-nums text-muted">{profile!.xp} XP · {lv.next - profile!.xp} XP lagi ke level {lv.level + 1}</p>
        </div>
        <Progress value={lv.progress * 100} className="mt-3 h-2.5" />
      </Card>

      <h2 className="mb-3 mt-6 font-bold text-navy-900">Rekor pribadi</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Runtun terpanjang" value={`${profile!.longest_streak} hari`} />
        <Stat label="Soal terbanyak sehari" value={data.records.bestDay} />
        <Stat label="XP terbanyak sehari" value={data.records.bestXpDay} />
        <Stat label="Akurasi simulasi terbaik" value={data.records.bestAccuracy ? `${data.records.bestAccuracy}%` : "–"} />
        <Stat label="Hari aktif" value={data.records.activeDays} />
      </div>

      <h2 className="mb-3 mt-6 font-bold text-navy-900">Lencana <span className="font-medium text-muted">({data.earned.size} dari {data.all.length})</span></h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.all.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const at = data.earned.get(a.code);
          const value = Math.min(data.stats[a.metric] ?? 0, a.threshold);
          return (
            <Card key={a.code} className={cn("p-4", !at && "bg-canvas shadow-none")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", at ? "bg-navy-900 text-cyan-500" : "bg-line text-faint")}>
                  {at ? <Icon className="size-5" /> : <Lock className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-bold", at ? "text-navy-900" : "text-muted")}>{a.name}</p>
                  <p className="text-sm text-muted">{a.description}</p>
                </div>
              </div>
              {at ? (
                <p className="mt-3 text-xs font-semibold text-good">Diperoleh {formatDate(at)} · +{a.xp_reward} XP</p>
              ) : (
                <div className="mt-3">
                  <Progress value={percent(value, a.threshold)} />
                  <p className="mt-1 text-xs tabular-nums text-muted">{value} / {a.threshold} · hadiah +{a.xp_reward} XP</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
