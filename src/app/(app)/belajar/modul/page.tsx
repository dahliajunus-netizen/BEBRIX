"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, Progress, Spinner } from "@/components/ui";
import { MODULE_ORDER, MODULES, type Exercise } from "@/content/modules";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Unlocked } from "@/lib/types";
import { cn, percent, TOPIC_NAMES } from "@/lib/utils";

const STEPS = [
  { id: "konsep", label: "Konsep" },
  { id: "contoh", label: "Contoh" },
  { id: "demo", label: "Demonstrasi" },
  { id: "latihan", label: "Latihan terbimbing" },
  { id: "asesmen", label: "Asesmen" },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const REQUIRED = 5; // assessment answers needed to finish a module (checked again on the server)

export default function ModulePage() {
  const slug = useSearchParams().get("m") ?? "";
  const m = MODULES[slug];
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const uid = profile!.id;
  const [step, setStep] = useState<StepId>("konsep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<{ xp: number; achievements: Unlocked[] } | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    if (!m) return null;
    const sb = supabase();
    const [steps, answers] = await Promise.all([
      sb.from("lesson_progress").select("step").eq("user_id", uid).eq("module", slug),
      sb.from("student_answers").select("is_correct, questions!inner(topic)").eq("user_id", uid).eq("mode", "modul").eq("questions.topic", slug),
    ]);
    const a = unwrap(answers) as unknown as { is_correct: boolean }[];
    return { done: new Set((unwrap(steps) as { step: string }[]).map((s) => s.step)), answered: a.length, correct: a.filter((x) => x.is_correct).length };
  }, [slug, uid]);

  const mark = useCallback(async (id: string) => {
    const { data: res } = await supabase().rpc("complete_lesson", { p_module: slug, p_step: id });
    return res as { xp_awarded: number; achievements: Unlocked[] } | null;
  }, [slug]);

  // Opening a reading step counts as having visited it.
  useEffect(() => {
    if (!data || !m || step === "latihan" || step === "asesmen" || data.done.has(step)) return;
    mark(step).then(reload);
  }, [step, data, m, mark, reload]);

  if (!m) return <EmptyState title="Modul tidak ditemukan" action={<ButtonLink href="/belajar">Ke daftar modul</ButtonLink>} />;
  if (loading && !data) return <Spinner />;
  const done = data?.done ?? new Set<string>();
  const index = STEPS.findIndex((s) => s.id === step);
  const nextSlug = MODULE_ORDER[MODULE_ORDER.indexOf(slug) + 1];
  const readyToFinish = ["konsep", "contoh", "demo", "latihan"].every((s) => done.has(s)) && (data?.answered ?? 0) >= REQUIRED;

  const startAssessment = async () => {
    setBusy(true);
    setError(null);
    const { data: sid, error } = await supabase().rpc("start_practice", { p_mode: "modul", p_config: { topics: [slug], count: REQUIRED, label: `Asesmen modul ${TOPIC_NAMES[slug]}` } });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.push(`/latihan/sesi?id=${sid}`);
  };
  const finish = async () => {
    setBusy(true);
    setError(null);
    const { data: res, error } = await supabase().rpc("complete_lesson", { p_module: slug, p_step: "selesai" });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setReward({ xp: res.xp_awarded, achievements: res.achievements });
    await Promise.all([reload(), refreshProfile()]);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/belajar" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-700"><ArrowLeft className="size-4" />Semua modul</Link>
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-white"><m.icon className="size-6" /></span>
        <div>
          <p className="text-xs font-bold text-faint">MODUL {MODULE_ORDER.indexOf(slug) + 1}</p>
          <h1 className="text-2xl font-bold text-navy-900 sm:text-[28px]">{TOPIC_NAMES[slug]}</h1>
          <p className="mt-1 text-muted">{m.tagline}</p>
        </div>
      </div>

      <nav className="mt-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Langkah modul">
        {STEPS.map((s, i) => {
          const complete = s.id === "asesmen" ? done.has("selesai") : done.has(s.id);
          return (
            <button key={s.id} onClick={() => setStep(s.id)} aria-current={step === s.id ? "step" : undefined}
              className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", step === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-muted hover:border-brand-500")}>
              {complete ? <CheckCircle2 className={cn("size-4", step === s.id ? "text-white" : "text-good")} /> : <Circle className="size-4 opacity-50" />}
              {i + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      <Card className="mt-4 p-5 sm:p-7">
        {step === "konsep" && (
          <div className="space-y-5">
            <div className="space-y-3 text-[15px] leading-relaxed text-ink">{m.intro.map((p) => <p key={p}>{p}</p>)}</div>
            <div className="flex justify-center rounded-xl bg-canvas p-4">{m.illustration}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {m.ideas.map((idea, i) => (
                <div key={idea.title} className="rounded-xl border border-line p-4">
                  <p className="text-xs font-bold text-cyan-600">LANGKAH {i + 1}</p>
                  <p className="mt-1 font-bold text-navy-900">{idea.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{idea.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "contoh" && (
          <div>
            <h2 className="text-lg font-bold text-navy-900">{m.example.title}</h2>
            <p className="mt-2 rounded-xl bg-canvas p-4 text-[15px] leading-relaxed text-ink">{m.example.situation}</p>
            <ol className="mt-4 space-y-3">
              {m.example.steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-relaxed text-ink">{s}</span>
                </li>
              ))}
            </ol>
            <Notice tone="cyan" className="mt-5" title="Yang perlu diingat">{m.example.takeaway}</Notice>
          </div>
        )}

        {step === "demo" && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-navy-900">{m.demoTitle}</h2>
            <m.Demo />
          </div>
        )}

        {step === "latihan" && <Guided exercises={m.exercises} alreadyDone={done.has("latihan")} onComplete={async () => { await mark("latihan"); reload(); }} />}

        {step === "asesmen" && (
          <div>
            <h2 className="text-lg font-bold text-navy-900">Asesmen dengan soal Bebras asli</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              Asesmen mengambil {REQUIRED} soal {TOPIC_NAMES[slug]} dari bank soal Tantangan Bebras Indonesia. Jawabanmu masuk ke analitik dan XP seperti latihan biasa. Modul dinyatakan selesai setelah empat langkah sebelumnya dibuka dan kamu sudah menjawab sedikitnya {REQUIRED} soal asesmen.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">Soal asesmen dijawab</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900">{Math.min(data?.answered ?? 0, REQUIRED)} / {REQUIRED}</p>
                <Progress value={percent(Math.min(data?.answered ?? 0, REQUIRED), REQUIRED)} className="mt-2" />
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">Akurasi asesmen</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900">{data?.answered ? `${percent(data.correct, data.answered)}%` : "–"}</p>
                <p className="mt-1 text-xs text-muted">{data?.answered ? `${data.correct} benar dari ${data.answered} jawaban` : "Belum ada jawaban"}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm">
              {STEPS.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-2">{done.has(s.id) ? <CheckCircle2 className="size-4 text-good" /> : <Circle className="size-4 text-faint" />}<span className={done.has(s.id) ? "text-ink" : "text-muted"}>{s.label}</span></li>
              ))}
            </ul>
            {error && <Notice tone="bad" className="mt-4">{error}</Notice>}
            {reward && <Notice tone="good" className="mt-4" title="Modul selesai">{reward.xp > 0 ? `+${reward.xp} XP. ` : ""}{reward.achievements.map((a) => `Pencapaian baru: ${a.name}.`).join(" ")}</Notice>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={startAssessment} loading={busy} variant={readyToFinish && !done.has("selesai") ? "secondary" : "primary"}>{data?.answered ? "Kerjakan asesmen lagi" : "Mulai asesmen"}</Button>
              {done.has("selesai") ? (
                <Badge tone="good" className="px-3 py-2 text-sm"><CheckCircle2 className="size-4" />Modul selesai</Badge>
              ) : (
                <Button onClick={finish} disabled={!readyToFinish} loading={busy}><Sparkles className="size-4" />Tandai modul selesai (+40 XP)</Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={index === 0} onClick={() => setStep(STEPS[index - 1].id)}><ArrowLeft className="size-4" />Sebelumnya</Button>
        {index < STEPS.length - 1 ? (
          <Button onClick={() => setStep(STEPS[index + 1].id)}>Berikutnya<ArrowRight className="size-4" /></Button>
        ) : nextSlug ? (
          <ButtonLink href={`/belajar/modul?m=${nextSlug}`} variant="secondary">Modul berikutnya: {TOPIC_NAMES[nextSlug]}<ArrowRight className="size-4" /></ButtonLink>
        ) : <ButtonLink href="/belajar" variant="secondary">Semua modul</ButtonLink>}
      </div>
    </div>
  );
}

/** Guided exercises: hint first, then the full reasoning. Checked locally (original BEBRIX items, no XP). */
function Guided({ exercises, alreadyDone, onComplete }: { exercises: Exercise[]; alreadyDone: boolean; onComplete: () => void }) {
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState<Set<number>>(new Set());
  const ex = exercises[i];
  const right = choice === ex.answer;

  const pick = (k: number) => {
    setChoice(k);
    if (k === ex.answer) {
      const next = new Set(solved).add(i);
      setSolved(next);
      if (next.size === exercises.length && !alreadyDone) onComplete();
    }
  };
  const move = (to: number) => { setI(to); setChoice(null); setHint(false); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-navy-900">Latihan terbimbing {i + 1} dari {exercises.length}</h2>
        <Badge tone="warn">Latihan orisinal BEBRIX, bukan soal Bebras</Badge>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">{ex.prompt}</p>
      <div className="mt-4 space-y-2">
        {ex.options.map((o, k) => (
          <button key={o} onClick={() => pick(k)} disabled={right}
            className={cn("flex w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-[15px]",
              choice === k ? (k === ex.answer ? "border-good bg-good-50" : "border-bad bg-bad-50") : "border-line bg-surface", !right && "hover:border-brand-500")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-navy-800">{"ABCD"[k]}</span>{o}
          </button>
        ))}
      </div>
      {choice !== null && !right && <Notice tone="bad" className="mt-4" title="Belum tepat">{ex.hint}</Notice>}
      {choice === null && (
        <div className="mt-4">
          {hint ? <Notice tone="brand" title="Petunjuk">{ex.hint}</Notice> : <button onClick={() => setHint(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><Lightbulb className="size-4" />Minta petunjuk</button>}
        </div>
      )}
      {right && <Notice tone="good" className="mt-4" title="Benar">{ex.explain}</Notice>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">{solved.size} dari {exercises.length} latihan terjawab benar{alreadyDone ? " · langkah ini sudah pernah kamu tuntaskan" : ""}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={i === 0} onClick={() => move(i - 1)}>Sebelumnya</Button>
          <Button size="sm" disabled={i === exercises.length - 1} onClick={() => move(i + 1)}>Latihan berikutnya</Button>
        </div>
      </div>
    </div>
  );
}
