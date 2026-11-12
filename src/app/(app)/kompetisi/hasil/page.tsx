"use client";

import { CheckCircle2, ChevronDown, MinusCircle, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AnswerInput } from "@/components/question/answer-input";
import { FeedbackPanel, QuestionBody, SourceNote } from "@/components/question/question-card";
import { ButtonLink, Card, EmptyState, Notice, PageHeader, Progress, Spinner, Stat } from "@/components/ui";
import { scoringText } from "@/lib/competition";
import { fetchQuestions } from "@/lib/data";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { AnswerKey, Block, Competition, CompetitionResult, CompetitionSession, Response } from "@/lib/types";
import { cn, formatDate, formatDuration, percent, TOPIC_NAMES } from "@/lib/utils";

interface ReviewRow { question_id: string; response: Response | null; is_correct: boolean; answered: boolean; key: AnswerKey | null; explanation: Block[]; informatics: Block[] }

export default function CompetitionResultPage() {
  const id = useSearchParams().get("id") ?? "";
  const [open, setOpen] = useState<string | null>(null);

  const { data, loading, error } = useQuery(async () => {
    const sb = supabase();
    await sb.rpc("finalize_expired");
    const session = unwrap(await sb.from("competition_sessions").select("*").eq("id", id).maybeSingle()) as CompetitionSession | null;
    if (!session || session.status !== "submitted") return null;
    const [result, comp, review, questions, history] = await Promise.all([
      sb.from("competition_results").select("*").eq("session_id", id).maybeSingle(),
      sb.from("competitions").select("*").eq("id", session.competition_id).maybeSingle(),
      sb.rpc("get_competition_review", { p_session: id }),
      fetchQuestions(session.question_ids),
      sb.from("competition_results").select("session_id, score, max_score, accuracy, time_spent_seconds, created_at").eq("competition_id", session.competition_id).eq("user_id", session.user_id).order("created_at"),
    ]);
    return {
      result: unwrap(result) as CompetitionResult, comp: unwrap(comp) as Competition | null,
      review: new Map(((unwrap(review) as ReviewRow[]) ?? []).map((r) => [r.question_id, r])), questions,
      history: unwrap(history) as Pick<CompetitionResult, "session_id" | "score" | "max_score" | "accuracy" | "time_spent_seconds" | "created_at">[],
    };
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <Notice tone="bad" title="Hasil gagal dimuat">{error}</Notice>;
  if (!data?.result) return <EmptyState title="Hasil belum tersedia" action={<ButtonLink href="/kompetisi">Ke daftar kompetisi</ButtonLink>}>Percobaan ini belum dikumpulkan atau tidak ditemukan.</EmptyState>;

  const { result, comp, review, questions, history } = data;
  const position = history.findIndex((h) => h.session_id === result.session_id);
  const previous = position > 0 ? history[position - 1] : null;
  const best = history.reduce((m, h) => Math.max(m, Number(h.score)), -Infinity);
  const delta = previous ? Number(result.score) - Number(previous.score) : null;

  return (
    <div>
      <PageHeader title="Hasil simulasi" description={`${comp?.title ?? "Kompetisi"} · ${formatDate(result.created_at, true)}${comp ? ` · ${scoringText(comp)}` : ""}`}
        actions={<><ButtonLink href="/kompetisi" variant="secondary">Daftar kompetisi</ButtonLink><ButtonLink href="/analitik">Analitik</ButtonLink></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card className="col-span-2 bg-navy-900 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Skor total</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums">{Number(result.score)}<span className="text-lg font-semibold text-white/50"> / {Number(result.max_score)}</span></p>
          {Number(result.score) === best && history.length > 1 && <p className="mt-1 text-sm font-semibold text-cyan-500">Skor terbaikmu di kompetisi ini</p>}
        </Card>
        <Stat label="Benar" value={result.correct} icon={<CheckCircle2 className="size-4 text-good" />} />
        <Stat label="Salah" value={result.incorrect} icon={<XCircle className="size-4 text-bad" />} />
        <Stat label="Kosong" value={result.unanswered} icon={<MinusCircle className="size-4 text-faint" />} />
        <Stat label="Akurasi" value={`${Number(result.accuracy)}%`} hint={formatDuration(result.time_spent_seconds)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Performa per topik</h2>
          <ul className="mt-4 space-y-3">
            {Object.entries(result.topic_breakdown).sort((a, b) => b[1].total - a[1].total).map(([t, v]) => (
              <li key={t}>
                <div className="flex justify-between text-sm"><span className="font-medium text-ink">{TOPIC_NAMES[t] ?? t}</span><span className="tabular-nums text-muted">{v.correct} / {v.total}</span></div>
                <Progress value={percent(v.correct, v.total)} tone={percent(v.correct, v.total) >= 60 ? "good" : "brand"} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Dibanding percobaan sebelumnya</h2>
          {previous && delta !== null ? (
            <>
              <p className={cn("mt-4 inline-flex items-center gap-2 text-lg font-bold", delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-muted")}>
                {delta > 0 ? <TrendingUp className="size-5" /> : delta < 0 ? <TrendingDown className="size-5" /> : null}
                {delta > 0 ? `Naik ${delta} poin` : delta < 0 ? `Turun ${Math.abs(delta)} poin` : "Skor sama"}
              </p>
              <p className="text-sm text-muted">Percobaan sebelumnya ({formatDate(previous.created_at)}): {Number(previous.score)} / {Number(previous.max_score)}, akurasi {Number(previous.accuracy)}%.</p>
            </>
          ) : <p className="mt-4 text-sm text-muted">Ini percobaan pertamamu di kompetisi ini. Perbandingan akan muncul setelah percobaan berikutnya.</p>}
          {history.length > 1 && (
            <div className="mt-4 flex h-24 items-end gap-2" role="img" aria-label={`Skor tiap percobaan: ${history.map((h) => Number(h.score)).join(", ")}`}>
              {history.slice(-10).map((h) => (
                <div key={h.session_id} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] tabular-nums text-muted">{Number(h.score)}</span>
                  <div className={cn("w-full max-w-10 rounded-t", h.session_id === result.session_id ? "bg-brand-600" : "bg-line")} style={{ height: `${Math.max(4, (Math.max(0, Number(h.score)) / Math.max(1, Number(h.max_score))) * 64)}px` }} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-navy-900">Pembahasan setiap soal</h2>
      <div className="space-y-2.5">
        {questions.map((q, i) => {
          const r = review.get(q.id);
          const isOpen = open === q.id;
          return (
            <Card key={q.id} className="overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-canvas">
                {!r?.answered ? <MinusCircle className="size-5 shrink-0 text-faint" /> : r.is_correct ? <CheckCircle2 className="size-5 shrink-0 text-good" /> : <XCircle className="size-5 shrink-0 text-bad" />}
                <span className="min-w-0 flex-1 truncate font-semibold text-navy-900">{i + 1}. {q.title}</span>
                <span className="hidden text-xs text-muted sm:inline">{TOPIC_NAMES[q.topic]}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && r && (
                <div className="border-t border-line p-5 sm:p-7">
                  <QuestionBody q={q} />
                  <div className="mt-6 border-t border-line pt-5"><AnswerInput question={q} value={r.response ?? {}} onChange={() => {}} disabled reveal={r.key} /></div>
                  {!r.answered && <Notice tone="warn" className="mt-4">Soal ini tidak kamu jawab.</Notice>}
                  <div className="mt-6"><FeedbackPanel q={q} feedback={{ is_correct: r.is_correct, key: r.key, explanation: r.explanation, informatics: r.informatics }} /></div>
                  <div className="mt-6 border-t border-line pt-4"><SourceNote q={q} /></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
