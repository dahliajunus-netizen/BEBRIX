"use client";

import { Bookmark, BookmarkCheck, CheckCircle2, FileSearch, Lightbulb, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnswerInput } from "./answer-input";
import { Blocks, Figure } from "./blocks";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { TOPIC_TIPS } from "@/content/tips";
import { hasResponse, submitAnswer } from "@/lib/data";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Feedback, Question, Response } from "@/lib/types";
import { cn, DIFFICULTY_NAMES, FORMAT_NAMES, TOPIC_NAMES } from "@/lib/utils";

/** Source line + metadata. Historical questions always show their book and year. */
export function QuestionMeta({ q }: { q: Question }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {q.origin === "historical" ? (
        <Badge tone="brand">Soal asli Bebras {q.year}{q.code ? ` · ${q.code}` : ""}</Badge>
      ) : (
        <Badge tone="warn">Soal latihan orisinal BEBRIX</Badge>
      )}
      <Badge tone="cyan">{TOPIC_NAMES[q.topic] ?? q.topic}</Badge>
      <Badge>{DIFFICULTY_NAMES[q.difficulty]}</Badge>
      <Badge>{FORMAT_NAMES[q.format]}</Badge>
    </div>
  );
}

export function QuestionBody({ q, heading }: { q: Question; heading?: string }) {
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <div>
      <QuestionMeta q={q} />
      <h2 className="mt-3 text-xl font-bold text-navy-900">{heading ? `${heading} · ` : ""}{q.title}</h2>
      <Blocks blocks={q.stem} className="mt-4" />
      {q.original.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowOriginal((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
            <FileSearch className="size-4" />
            {showOriginal ? "Sembunyikan tampilan asli buku" : "Lihat tampilan asli dari buku"}
          </button>
          {showOriginal && (
            <div className="mt-2 space-y-2 overflow-x-auto rounded-xl border border-line bg-white p-2">
              {q.original.map((o) => <Figure key={o.src} {...o} alt="Halaman asli soal" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceNote({ q }: { q: Question }) {
  if (q.origin !== "historical" || !q.question_sources) return null;
  return (
    <p className="text-xs leading-relaxed text-faint">
      Sumber: {q.question_sources.title}{q.pages.length ? `, hlm. PDF ${q.pages.join("–")}` : ""}. © Bebras – International Challenge on Informatics and Computational Thinking, diterjemahkan oleh Bebras Indonesia (bebras.or.id). Lisensi {q.question_sources.license}.
      {q.code_note ? ` Catatan: ${q.code_note}` : ""}
    </p>
  );
}

export function FeedbackPanel({ q, feedback }: { q: Question; feedback: Feedback }) {
  const tips = TOPIC_TIPS[q.topic];
  const correctText = feedback.key?.correct
    ? feedback.key.correct.map((l) => { const o = q.question_options.find((x) => x.label === l); return o?.text ? `${l}. ${o.text}` : l; }).join(q.format === "ordering" ? " → " : ", ")
    : feedback.key?.accepted?.[0];
  return (
    <div className="animate-rise space-y-4" aria-live="polite">
      <div className={cn("flex items-start gap-3 rounded-xl border-2 px-4 py-3", feedback.is_correct ? "border-good bg-good-50" : "border-bad bg-bad-50")}>
        {feedback.is_correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-bad" />}
        <div className="min-w-0 text-sm">
          <p className="font-bold text-ink">{feedback.is_correct ? "Jawabanmu benar" : "Jawabanmu belum tepat"}</p>
          {correctText && <p className="mt-0.5 text-ink/80">Jawaban yang benar: <strong>{correctText}</strong></p>}
          {!!feedback.xp_awarded && <p className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-700"><Sparkles className="size-4" />+{feedback.xp_awarded} XP</p>}
        </div>
      </div>
      {feedback.achievements?.map((a) => (
        <Notice key={a.code} tone="cyan" title={`Pencapaian baru: ${a.name}`}>{a.description}</Notice>
      ))}
      {feedback.explanation.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-800">Pembahasan dari buku sumber</h3>
          <Blocks blocks={feedback.explanation} />
        </section>
      )}
      <section className="rounded-xl border border-line bg-canvas p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900"><Lightbulb className="size-4 text-cyan-600" />Konsep berpikir komputasional: {TOPIC_NAMES[q.topic]}</h3>
        {feedback.informatics.length > 0 && <Blocks blocks={feedback.informatics} className="mt-3 text-sm" />}
        {tips && (
          <div className="mt-3 border-t border-line pt-3 text-sm text-ink/85">
            <p className="font-semibold text-navy-800">Kesalahan yang sering terjadi pada soal {TOPIC_NAMES[q.topic].toLowerCase()}</p>
            <ul className="ml-5 mt-1.5 list-disc space-y-1">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="mt-2 text-xs text-faint">Catatan belajar dari BEBRIX, bukan bagian dari buku sumber.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function BookmarkButton({ questionId }: { questionId: string }) {
  const { session } = useAuth();
  const [on, setOn] = useState(false);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase().from("bookmarks").select("question_id").eq("question_id", questionId).maybeSingle().then(({ data }) => alive && setOn(Boolean(data)));
    return () => { alive = false; };
  }, [questionId, uid]);
  const toggle = async () => {
    if (!uid) return;
    const next = !on;
    setOn(next);
    const { error } = next
      ? await supabase().from("bookmarks").insert({ user_id: uid, question_id: questionId })
      : await supabase().from("bookmarks").delete().eq("user_id", uid).eq("question_id", questionId);
    if (error) setOn(!next);
  };
  return (
    <Button variant="secondary" size="sm" onClick={toggle} aria-pressed={on}>
      {on ? <BookmarkCheck className="size-4 text-brand-600" /> : <Bookmark className="size-4" />}
      {on ? "Tersimpan" : "Simpan"}
    </Button>
  );
}

/**
 * A complete practice question: body, answer input, server-side validation and feedback.
 * `initial` shows an earlier result (review mode); `onAnswered` reports the fresh result.
 */
export function PracticeQuestion({
  q, mode, sessionId, heading, initial, onAnswered, footer,
}: {
  q: Question;
  mode: string;
  sessionId?: string | null;
  heading?: string;
  initial?: Feedback | null;
  onAnswered?: (f: Feedback) => void;
  footer?: React.ReactNode;
}) {
  const { refreshProfile } = useAuth();
  const [response, setResponse] = useState<Response>(initial?.response ?? {});
  const [feedback, setFeedback] = useState<Feedback | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(0);

  useEffect(() => {
    setResponse(initial?.response ?? {});
    setFeedback(initial ?? null);
    setError(null);
    started.current = performance.now();
  }, [q.id, initial]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const f = await submitAnswer({ questionId: q.id, response, sessionId, mode, timeMs: performance.now() - started.current });
      setFeedback({ ...f, response });
      onAnswered?.({ ...f, response });
      refreshProfile();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const retry = () => {
    setFeedback(null);
    setResponse({});
    started.current = performance.now();
  };

  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-4 flex justify-end"><BookmarkButton questionId={q.id} /></div>
      <QuestionBody q={q} heading={heading} />
      <div className="mt-6 border-t border-line pt-5">
        <AnswerInput question={q} value={response} onChange={setResponse} disabled={Boolean(feedback) || busy} reveal={feedback?.key} />
      </div>
      {error && <Notice tone="bad" className="mt-4">{error}</Notice>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!feedback ? (
          <Button onClick={submit} loading={busy} disabled={!hasResponse(response)}>Periksa jawaban</Button>
        ) : (
          <Button variant="secondary" onClick={retry}>Coba lagi</Button>
        )}
        {footer}
      </div>
      {feedback && <div className="mt-6"><FeedbackPanel q={q} feedback={feedback} /></div>}
      <div className="mt-6 border-t border-line pt-4"><SourceNote q={q} /></div>
    </Card>
  );
}
