"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, CloudOff, Flag, LayoutGrid, Timer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { AnswerInput } from "@/components/question/answer-input";
import { QuestionBody } from "@/components/question/question-card";
import { Button, ButtonLink, Card, EmptyState, Modal, Notice, Spinner } from "@/components/ui";
import { fetchQuestions, hasResponse } from "@/lib/data";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Competition, CompetitionSession, Response } from "@/lib/types";
import { clock, cn } from "@/lib/utils";

const backupKey = (id: string) => `bebrix:kompetisi:${id}`;

/** The timed attempt. Answers autosave to the server; localStorage is only an offline backup. */
export default function CompetitionRun() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Response>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const submitted = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data, loading, error: loadError } = useQuery(async () => {
    const sb = supabase();
    const session = unwrap(await sb.from("competition_sessions").select("*").eq("id", id).maybeSingle()) as CompetitionSession | null;
    if (!session) return null;
    const [comp, questions, now] = await Promise.all([
      sb.from("competitions").select("*").eq("id", session.competition_id).maybeSingle(),
      fetchQuestions(session.question_ids),
      sb.rpc("server_time"),
    ]);
    const skew = now.data ? new Date(now.data as string).getTime() - Date.now() : 0;
    return { session, comp: unwrap(comp) as Competition, questions, skew };
  }, [id]);

  const session = data?.session;
  const deadline = session?.deadline ? new Date(session.deadline).getTime() : null;

  const save = useCallback(async (qid: string, response: Response | null, mark: boolean | null = null) => {
    const { data: res, error } = await supabase().rpc("save_competition_answer", { p_session: id, p_question: qid, p_response: response, p_marked: mark });
    if (error) {
      setUnsaved((s) => new Set(s).add(qid));
      return;
    }
    setUnsaved((s) => { const n = new Set(s); n.delete(qid); return n; });
    if (res && res.saved === false) router.replace(`/kompetisi/hasil?id=${id}`);
  }, [id, router]);

  const submit = useCallback(async () => {
    if (submitted.current) return; // guards double clicks and the timer racing a manual submit
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      Object.values(timers.current).forEach(clearTimeout);
      // Flush anything the autosave has not confirmed yet.
      await Promise.all([...unsaved].map((qid) => save(qid, answers[qid] ?? null)));
      const { error } = await supabase().rpc("submit_competition", { p_session: id });
      if (error) throw error;
      localStorage.removeItem(backupKey(id));
      router.replace(`/kompetisi/hasil?id=${id}`);
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      setError(errorMessage(e));
    }
  }, [answers, id, router, save, unsaved]);

  // Restore state; merge the offline backup for answers the server never received.
  useEffect(() => {
    if (!session) return;
    if (session.status === "submitted") return void router.replace(`/kompetisi/hasil?id=${id}`);
    let merged = session.answers ?? {};
    try {
      const backup = JSON.parse(localStorage.getItem(backupKey(id)) ?? "{}") as Record<string, Response>;
      for (const [qid, r] of Object.entries(backup)) {
        if (session.question_ids.includes(qid) && JSON.stringify(merged[qid]) !== JSON.stringify(r)) {
          merged = { ...merged, [qid]: r };
          save(qid, r);
        }
      }
    } catch { /* ignore a corrupt backup */ }
    setAnswers(merged);
    setMarked(session.marked ?? []);
  }, [session, id, router, save]);

  // Countdown on the server clock; submits by itself when it reaches zero.
  useEffect(() => {
    if (!deadline || !data) return;
    const tick = () => {
      const left = (deadline - (Date.now() + data.skew)) / 1000;
      setRemaining(left);
      if (left <= 0) submit();
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline, data, submit]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (!submitted.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const questions = useMemo(() => data?.questions ?? [], [data]);

  if (loading) return <Spinner />;
  if (loadError) return <div className="p-6"><Notice tone="bad" title="Sesi gagal dimuat">{loadError}</Notice></div>;
  if (!data || !session || !questions.length) return <div className="p-6"><EmptyState title="Sesi tidak ditemukan" action={<ButtonLink href="/kompetisi">Ke daftar kompetisi</ButtonLink>} /></div>;

  const q = questions[index];
  const answeredCount = questions.filter((x) => hasResponse(answers[x.id])).length;
  const urgent = remaining !== null && remaining <= 300;

  const change = (r: Response) => {
    const next = { ...answers, [q.id]: r };
    setAnswers(next);
    try { localStorage.setItem(backupKey(id), JSON.stringify(next)); } catch { /* storage full or blocked */ }
    setUnsaved((s) => new Set(s).add(q.id));
    clearTimeout(timers.current[q.id]);
    timers.current[q.id] = setTimeout(() => save(q.id, hasResponse(r) ? r : null), 500);
  };
  const toggleMark = () => {
    const on = !marked.includes(q.id);
    setMarked((m) => (on ? [...m, q.id] : m.filter((x) => x !== q.id)));
    save(q.id, answers[q.id] ?? null, on);
  };

  const grid = (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((x, i) => {
          const done = hasResponse(answers[x.id]);
          const flag = marked.includes(x.id);
          return (
            <button key={x.id} onClick={() => { setIndex(i); setPanel(false); }} aria-label={`Soal ${i + 1}${done ? ", terjawab" : ", belum dijawab"}${flag ? ", ditandai" : ""}`} aria-current={i === index}
              className={cn("relative h-10 rounded-lg text-sm font-bold tabular-nums", i === index && "ring-2 ring-brand-600 ring-offset-2",
                done ? "bg-navy-800 text-white" : "border border-line bg-surface text-muted hover:border-brand-500")}>
              {i + 1}
              {flag && <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface bg-warn" />}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-muted">
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-navy-800" />Terjawab ({answeredCount})</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded border border-line bg-surface" />Belum dijawab ({questions.length - answeredCount})</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-warn" />Ditandai ragu-ragu ({marked.length})</li>
      </ul>
      <Button className="mt-5 w-full" onClick={() => setConfirm(true)}><Flag className="size-4" />Kumpulkan</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="hidden sm:inline-flex" />
            <span className="truncate text-sm font-semibold text-navy-900">{data.comp.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {unsaved.size > 0 && <span className="hidden items-center gap-1 text-xs text-warn sm:inline-flex" title="Jawaban tersimpan di perangkat dan akan dikirim ulang"><CloudOff className="size-4" />Menyimpan…</span>}
            <span role="timer" aria-live={urgent ? "polite" : "off"} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums", urgent ? "bg-bad-50 text-bad" : "bg-canvas text-navy-900")}>
              <Timer className="size-4" />{remaining === null ? "Tanpa batas waktu" : clock(remaining)}
            </span>
            <button onClick={() => setPanel(true)} aria-label="Daftar soal" className="rounded-lg border border-line p-2 text-navy-900 lg:hidden"><LayoutGrid className="size-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {error && <Notice tone="bad" className="mb-4" title="Gagal mengumpulkan">{error} Jawabanmu masih tersimpan. Coba kumpulkan lagi.</Notice>}
          <Card className="p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted">Soal {index + 1} dari {questions.length}</p>
              <Button size="sm" variant={marked.includes(q.id) ? "primary" : "secondary"} onClick={toggleMark} aria-pressed={marked.includes(q.id)}>
                <Bookmark className="size-4" />{marked.includes(q.id) ? "Ditandai ragu-ragu" : "Tandai ragu-ragu"}
              </Button>
            </div>
            <QuestionBody q={q} />
            <div className="mt-6 border-t border-line pt-5">
              <AnswerInput question={q} value={answers[q.id] ?? {}} onChange={change} disabled={submitting} />
              {hasResponse(answers[q.id]) && <button onClick={() => change({})} className="mt-3 text-sm font-semibold text-muted hover:text-bad">Hapus jawaban</button>}
            </div>
          </Card>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft className="size-4" />Sebelumnya</Button>
            {index === questions.length - 1
              ? <Button onClick={() => setConfirm(true)}><Flag className="size-4" />Kumpulkan</Button>
              : <Button onClick={() => setIndex(index + 1)}>Berikutnya<ArrowRight className="size-4" /></Button>}
          </div>
        </div>
        <aside className="hidden lg:block"><Card className="sticky top-20 p-4"><p className="mb-3 text-sm font-bold text-navy-900">Navigasi soal</p>{grid}</Card></aside>
      </div>

      <Modal open={panel} onClose={() => setPanel(false)} title="Navigasi soal">{grid}</Modal>
      <Modal open={confirm} onClose={() => !submitting && setConfirm(false)} title="Kumpulkan jawaban?"
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)} disabled={submitting}>Periksa lagi</Button><Button onClick={submit} loading={submitting}>Ya, kumpulkan</Button></>}>
        <p className="text-sm text-ink">Setelah dikumpulkan, jawaban tidak bisa diubah dan pembahasan akan terbuka.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>Terjawab: <strong>{answeredCount}</strong> dari {questions.length}</li>
          {questions.length - answeredCount > 0 && <li className="flex items-center gap-1.5 text-warn"><AlertTriangle className="size-4" />{questions.length - answeredCount} soal belum dijawab</li>}
          {marked.length > 0 && <li className="flex items-center gap-1.5 text-warn"><Bookmark className="size-4" />{marked.length} soal masih ditandai ragu-ragu</li>}
        </ul>
      </Modal>
    </div>
  );
}
