"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Flag, SkipForward, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PracticeQuestion } from "@/components/question/question-card";
import { Button, ButtonLink, Card, EmptyState, Notice, Progress, Spinner } from "@/components/ui";
import { fetchQuestions } from "@/lib/data";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { Feedback, Question, Response } from "@/lib/types";
import { cn, MODE_NAMES, percent } from "@/lib/utils";

interface Session { id: string; mode: string; label: string; question_ids: string[]; current_index: number; status: string }

/** Runs a practice session: one question at a time, resumable, with a summary at the end. */
export default function PracticeSession() {
  const id = useSearchParams().get("id") ?? "";
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, Feedback>>({});
  const [finished, setFinished] = useState(false);

  const { data, loading, error } = useQuery(async () => {
    const sb = supabase();
    const session = unwrap(await sb.from("practice_sessions").select("id, mode, label, question_ids, current_index, status").eq("id", id).maybeSingle()) as Session | null;
    if (!session) return null;
    const [questions, answers] = await Promise.all([
      fetchQuestions(session.question_ids),
      sb.from("student_answers").select("question_id, response, is_correct, created_at").eq("session_id", id).order("created_at"),
    ]);
    // Restore what was already answered in this session (page refresh, another device).
    const restored: Record<string, Feedback> = {};
    for (const a of unwrap(answers) as { question_id: string; response: Response; is_correct: boolean }[]) {
      restored[a.question_id] = { is_correct: a.is_correct, response: a.response, key: null, explanation: [], informatics: [] };
    }
    return { session, questions, restored };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    setIndex(Math.min(data.session.current_index, data.questions.length - 1));
    setResults(data.restored);
    setFinished(data.session.status === "completed");
  }, [data]);

  const go = useCallback((next: number, done = false) => {
    if (!data) return;
    const clamped = Math.max(0, Math.min(next, data.questions.length - 1));
    setIndex(clamped);
    if (done) setFinished(true);
    supabase().rpc("update_practice", { p_session: id, p_index: clamped, p_completed: done }).then(() => {});
    window.scrollTo({ top: 0 });
  }, [data, id]);

  if (loading) return <Spinner />;
  if (error) return <Notice tone="bad" title="Sesi gagal dimuat">{error}</Notice>;
  if (!data || !data.questions.length) return <EmptyState title="Sesi tidak ditemukan" action={<ButtonLink href="/latihan">Ke menu latihan</ButtonLink>} />;

  const { session, questions } = data;
  const answered = questions.filter((q) => results[q.id]).length;
  const correct = questions.filter((q) => results[q.id]?.is_correct).length;

  if (finished) return <Summary session={session} questions={questions} results={results} onReview={(i) => { setFinished(false); setIndex(i); }} />;

  const q = questions[index];
  const last = index === questions.length - 1;
  // Restored answers have no key yet: fetch the full review lazily through the card's own flow.
  const initial = results[q.id]?.key !== null ? results[q.id] : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-navy-900">{session.label || MODE_NAMES[session.mode]}</p>
          <p className="tabular-nums text-muted">Soal {index + 1} / {questions.length} · {correct} benar</p>
        </div>
        <Progress value={percent(answered, questions.length)} className="mt-2" />
        <div className="mt-3 flex flex-wrap gap-1.5" role="navigation" aria-label="Nomor soal">
          {questions.map((x, i) => {
            const r = results[x.id];
            return (
              <button key={x.id} onClick={() => go(i)} aria-label={`Soal ${i + 1}`} aria-current={i === index}
                className={cn("size-8 rounded-lg text-xs font-bold tabular-nums", i === index && "ring-2 ring-brand-600 ring-offset-2",
                  r ? (r.is_correct ? "bg-good text-white" : "bg-bad text-white") : "border border-line bg-surface text-muted hover:border-brand-500")}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {results[q.id] && !initial && <RestoredReview q={q} mode={session.mode} sessionId={session.id} onLoaded={(f) => setResults((r) => ({ ...r, [q.id]: f }))} />}
      {(!results[q.id] || initial) && (
        <PracticeQuestion key={q.id} q={q} mode={session.mode} sessionId={session.id} heading={`Soal ${index + 1}`} initial={initial}
          onAnswered={(f) => setResults((r) => ({ ...r, [q.id]: f }))}
          footer={!results[q.id] && !last ? <Button variant="ghost" onClick={() => go(index + 1)}><SkipForward className="size-4" />Lewati</Button> : null} />
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft className="size-4" />Sebelumnya</Button>
        {last ? (
          <Button onClick={() => go(index, true)}><Flag className="size-4" />Selesaikan sesi</Button>
        ) : (
          <Button onClick={() => go(index + 1)}>Berikutnya<ArrowRight className="size-4" /></Button>
        )}
      </div>
    </div>
  );
}

/** A question answered before a refresh: load its key and explanation again. */
function RestoredReview({ q, mode, sessionId, onLoaded }: { q: Question; mode: string; sessionId: string; onLoaded: (f: Feedback) => void }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useEffect(() => {
    let alive = true;
    supabase().rpc("get_review", { p_question_id: q.id }).then(({ data }) => {
      if (alive && data) { setFeedback(data as Feedback); onLoaded(data as Feedback); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);
  if (!feedback) return <Spinner label="Memuat jawabanmu…" />;
  return <PracticeQuestion q={q} mode={mode} sessionId={sessionId} initial={feedback} onAnswered={onLoaded} />;
}

function Summary({ session, questions, results, onReview }: { session: Session; questions: Question[]; results: Record<string, Feedback>; onReview: (i: number) => void }) {
  const answered = questions.filter((q) => results[q.id]);
  const correct = answered.filter((q) => results[q.id].is_correct).length;
  const xp = answered.reduce((s, q) => s + (results[q.id].xp_awarded ?? 0), 0);
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 text-center sm:p-8">
        <p className="text-sm font-semibold text-muted">{session.label || MODE_NAMES[session.mode]}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Sesi selesai</h1>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[[`${correct} / ${questions.length}`, "jawaban benar"], [`${percent(correct, questions.length)}%`, "akurasi"], [questions.length - answered.length, "dilewati"]].map(([v, l]) => (
            <div key={l as string} className="rounded-xl bg-canvas p-4"><p className="text-2xl font-bold tabular-nums text-navy-900">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
        {xp > 0 && <p className="mt-4 text-sm font-semibold text-brand-700">+{xp} XP dari sesi ini</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/latihan">Latihan baru</ButtonLink>
          <ButtonLink href="/analitik" variant="secondary">Lihat analitik</ButtonLink>
        </div>
      </Card>
      <Card className="mt-4 p-5">
        <h2 className="font-bold text-navy-900">Tinjau soal</h2>
        <ul className="mt-3 divide-y divide-line">
          {questions.map((q, i) => {
            const r = results[q.id];
            return (
              <li key={q.id} className="flex items-center gap-3 py-2.5">
                {r ? (r.is_correct ? <CheckCircle2 className="size-5 shrink-0 text-good" /> : <XCircle className="size-5 shrink-0 text-bad" />) : <SkipForward className="size-5 shrink-0 text-faint" />}
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{i + 1}. {q.title}</span>
                <Button size="sm" variant="ghost" onClick={() => onReview(i)}>{r ? "Pembahasan" : "Kerjakan"}</Button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
