"use client";

import { FileJson, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { emptyQuestionId, QuestionEditor, STATUS_NAMES } from "./question-editor";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Chip, EmptyState, Field, Input, Modal, Notice, Progress, Select, Spinner, Stat } from "@/components/ui";
import { COMPETITION_MODES, scoringText } from "@/lib/competition";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Competition, Difficulty, Status } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_NAMES, formatDate, formatDuration, percent, TOPIC_NAMES } from "@/lib/utils";

const th = "py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-faint";
const td = "py-2.5 pr-3 align-top";

/* ------------------------------------------------------------------ Ringkasan */
interface Stats {
  students: number; active_today: number; answers: number; accuracy: number | null; competition_attempts: number; competition_students: number;
  topics: { topic: string; name: string; answers: number; accuracy: number | null }[]; questions_by_status: Record<string, number>;
}

export function OverviewTab() {
  const { data, loading, error } = useQuery(async () => unwrap(await supabase().rpc("admin_stats")) as Stats, []);
  if (loading) return <Spinner />;
  if (error || !data) return <Notice tone="bad">{error}</Notice>;
  const max = Math.max(1, ...data.topics.map((t) => t.answers));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Siswa terdaftar" value={data.students} hint={`${data.active_today} aktif hari ini`} />
        <Stat label="Soal dijawab" value={data.answers} hint="seluruh siswa" />
        <Stat label="Akurasi rata-rata" value={data.accuracy !== null ? `${Number(data.accuracy)}%` : "–"} />
        <Stat label="Percobaan simulasi" value={data.competition_attempts} hint={`${data.competition_students} siswa ikut`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Topik paling banyak dikerjakan</h2>
          <ul className="mt-4 space-y-3">
            {data.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between text-sm"><span className="font-medium text-ink">{t.name}</span><span className="tabular-nums text-muted">{t.answers} jawaban{t.accuracy !== null ? ` · ${Number(t.accuracy)}% benar` : ""}</span></div>
                <Progress value={percent(t.answers, max)} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Status bank soal</h2>
          <ul className="mt-4 divide-y divide-line">
            {(Object.keys(STATUS_NAMES) as Status[]).map((s) => (
              <li key={s} className="flex justify-between py-2.5 text-sm"><span className="text-ink">{STATUS_NAMES[s]}</span><span className="font-semibold tabular-nums">{data.questions_by_status[s] ?? 0}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Siswa */
interface Student { id: string; username: string; full_name: string; grade: number | null; role: string; is_active: boolean; xp: number; streak: number; last_active: string | null; created_at: string; answers: number; accuracy: number | null; competitions: number }

export function StudentsTab() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Student | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, reload } = useQuery(async () => unwrap(await supabase().rpc("admin_students")) as Student[], []);

  const update = async (s: Student, patch: Partial<Pick<Student, "is_active" | "role">>) => {
    setError(null);
    const { error } = await supabase().from("profiles").update(patch).eq("id", s.id);
    if (error) setError(errorMessage(error));
    reload();
  };
  const rows = (data ?? []).filter((s) => `${s.username} ${s.full_name}`.toLowerCase().includes(search.toLowerCase()));

  if (loading && !data) return <Spinner />;
  return (
    <Card className="p-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau nama pengguna" className="pl-10" aria-label="Cari siswa" />
      </div>
      {error && <Notice tone="bad" className="mt-3">{error}</Notice>}
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line"><th className={th}>Siswa</th><th className={th}>Kelas</th><th className={th}>XP</th><th className={th}>Jawaban</th><th className={th}>Akurasi</th><th className={th}>Simulasi</th><th className={th}>Terakhir aktif</th><th className={th}>Akses</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className={td}><button onClick={() => setDetail(s)} className="text-left font-semibold text-brand-700 hover:underline">{s.full_name || s.username}</button><span className="block text-xs text-muted">@{s.username}{s.role === "admin" ? " · admin" : ""}</span></td>
                  <td className={td}>{s.grade ?? "–"}</td>
                  <td className={`${td} tabular-nums`}>{s.xp}</td>
                  <td className={`${td} tabular-nums`}>{s.answers}</td>
                  <td className={`${td} tabular-nums`}>{s.accuracy !== null ? `${Number(s.accuracy)}%` : "–"}</td>
                  <td className={`${td} tabular-nums`}>{s.competitions}</td>
                  <td className={`${td} text-muted`}>{s.last_active ? formatDate(s.last_active) : "–"}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" disabled={s.id === profile!.id} onClick={() => update(s, { is_active: !s.is_active })}>{s.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
                      <Button size="sm" variant="ghost" disabled={s.id === profile!.id} onClick={() => window.confirm(`${s.role === "admin" ? "Cabut hak admin dari" : "Jadikan admin:"} @${s.username}?`) && update(s, { role: s.role === "admin" ? "student" : "admin" })}>{s.role === "admin" ? "Cabut admin" : "Jadikan admin"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-4 text-sm text-muted">Belum ada siswa yang cocok.</p>}
      {detail && <StudentDetail student={detail} onClose={() => setDetail(null)} />}
    </Card>
  );
}

function StudentDetail({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data, loading } = useQuery(async () => {
    const sb = supabase();
    const [answers, lessons, results] = await Promise.all([
      sb.from("student_answers").select("is_correct, questions(topic)").eq("user_id", student.id),
      sb.from("lesson_progress").select("module").eq("user_id", student.id).eq("step", "selesai"),
      sb.from("competition_results").select("score, max_score, accuracy, created_at").eq("user_id", student.id).order("created_at", { ascending: false }).limit(5),
    ]);
    const topics: Record<string, { n: number; ok: number }> = {};
    for (const a of unwrap(answers) as unknown as { is_correct: boolean; questions: { topic: string } }[]) {
      const t = a.questions?.topic;
      if (!t) continue;
      (topics[t] ??= { n: 0, ok: 0 }).n++;
      if (a.is_correct) topics[t].ok++;
    }
    return { topics, modules: (unwrap(lessons) as { module: string }[]).map((l) => l.module), results: unwrap(results) as { score: number; max_score: number; accuracy: number; created_at: string }[] };
  }, [student.id]);
  return (
    <Modal open onClose={onClose} title={`Kemajuan @${student.username}`}>
      {loading || !data ? <Spinner /> : (
        <div className="space-y-5 text-sm">
          <div>
            <p className="font-semibold text-navy-900">Akurasi per topik</p>
            <ul className="mt-2 space-y-2">
              {Object.keys(TOPIC_NAMES).map((t) => (
                <li key={t}><div className="flex justify-between"><span>{TOPIC_NAMES[t]}</span><span className="tabular-nums text-muted">{data.topics[t] ? `${percent(data.topics[t].ok, data.topics[t].n)}% · ${data.topics[t].n} jawaban` : "belum ada"}</span></div><Progress value={data.topics[t] ? percent(data.topics[t].ok, data.topics[t].n) : 0} className="mt-1" /></li>
              ))}
            </ul>
          </div>
          <p><span className="font-semibold text-navy-900">Modul selesai:</span> {data.modules.length ? data.modules.map((m) => TOPIC_NAMES[m]).join(", ") : "belum ada"}</p>
          <div>
            <p className="font-semibold text-navy-900">Simulasi terakhir</p>
            {data.results.length ? <ul className="mt-1 space-y-1">{data.results.map((r) => <li key={r.created_at} className="tabular-nums">{formatDate(r.created_at)} · {Number(r.score)} / {Number(r.max_score)} · {Number(r.accuracy)}%</li>)}</ul> : <p className="text-muted">Belum ada.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Soal & tinjauan */
interface QRow { id: string; title: string; code: string | null; year: number | null; topic: string; difficulty: Difficulty; status: Status; origin: string; review_note: string | null }

export function QuestionsTab({ reviewOnly }: { reviewOnly?: boolean }) {
  const [status, setStatus] = useState<Status | "">(reviewOnly ? "needs_review" : "");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; isNew?: boolean } | null>(null);
  const { data, loading, reload } = useQuery(async () =>
    unwrap(await supabase().from("questions").select("id, title, code, year, topic, difficulty, status, origin, review_note").order("year", { ascending: false }).order("number")) as QRow[], []);

  const rows = useMemo(() => (data ?? []).filter((q) =>
    (reviewOnly ? q.status === "needs_review" || q.status === "draft" : !status || q.status === status) &&
    `${q.id} ${q.title} ${q.code ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, status, search, reviewOnly]);

  if (editing) return <QuestionEditor id={editing.id} isNew={editing.isNew} onClose={(changed) => { setEditing(null); if (changed) reload(); }} />;
  if (loading && !data) return <Spinner />;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, kode, atau ID" className="pl-10" aria-label="Cari soal" />
        </div>
        {!reviewOnly && (
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value as Status | "")} className="w-44" aria-label="Status">
              <option value="">Semua status</option>
              {(Object.keys(STATUS_NAMES) as Status[]).map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
            </Select>
            <Button onClick={() => setEditing({ id: emptyQuestionId(), isNew: true })}><Plus className="size-4" />Soal baru</Button>
          </>
        )}
      </div>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line"><th className={th}>Soal</th><th className={th}>Topik</th><th className={th}>Tingkat</th><th className={th}>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((q) => (
                <tr key={q.id}>
                  <td className={td}>
                    <span className="font-semibold text-ink">{q.title}</span>
                    <span className="block text-xs text-muted">{q.origin === "historical" ? `Bebras ${q.year}` : "Orisinal"} · {q.code ?? q.id}</span>
                    {reviewOnly && q.review_note && <span className="mt-1 block max-w-xl text-xs text-warn">{q.review_note}</span>}
                  </td>
                  <td className={td}>{TOPIC_NAMES[q.topic]}</td>
                  <td className={td}>{DIFFICULTY_NAMES[q.difficulty]}</td>
                  <td className={td}><Badge tone={q.status === "published" ? "good" : q.status === "needs_review" ? "warn" : "neutral"}>{STATUS_NAMES[q.status]}</Badge></td>
                  <td className={`${td} text-right`}><Button size="sm" variant="secondary" onClick={() => setEditing({ id: q.id })}>{reviewOnly ? "Tinjau" : "Sunting"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="mt-4"><EmptyState title={reviewOnly ? "Tidak ada soal yang menunggu tinjauan" : "Tidak ada soal yang cocok"} /></div>}
    </Card>
  );
}

/* ------------------------------------------------------------------ Impor */
export function ImportTab() {
  const json = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const { data: books, reload } = useQuery(async () => unwrap(await supabase().storage.from("source-books").list("", { sortBy: { column: "created_at", order: "desc" } })), []);

  const importJson = async (f: File | undefined) => {
    if (!f) return;
    setBusy("json");
    setMsg(null);
    try {
      const payload = JSON.parse(await f.text());
      if (!Array.isArray(payload.questions)) throw new Error("Berkas tidak berisi daftar \"questions\". Gunakan data/bank.json hasil npm run bank.");
      const n = unwrap(await supabase().rpc("import_questions", { p_payload: payload })) as number;
      setMsg({ tone: "good", text: `${n} soal diimpor dengan status “Perlu ditinjau”. Tidak ada yang terbit sebelum kamu memverifikasinya di antrean tinjauan.` });
    } catch (e) {
      setMsg({ tone: "bad", text: errorMessage(e) });
    }
    setBusy(null);
  };
  const uploadPdf = async (f: File | undefined) => {
    if (!f) return;
    setBusy("pdf");
    setMsg(null);
    const { error } = await supabase().storage.from("source-books").upload(f.name.replace(/[^a-zA-Z0-9._-]/g, "_"), f, { contentType: "application/pdf", upsert: true });
    setMsg(error ? { tone: "bad", text: errorMessage(error) } : { tone: "good", text: `${f.name} tersimpan di arsip buku sumber.` });
    setBusy(null);
    reload();
  };
  const removeBook = async (name: string) => {
    if (!window.confirm(`Hapus ${name} dari arsip?`)) return;
    await supabase().storage.from("source-books").remove([name]);
    reload();
  };

  return (
    <div className="space-y-4">
      <Notice title="Alur impor buku baru">
        <ol className="ml-5 mt-1 list-decimal space-y-1">
          <li>Arsipkan PDF buku di bawah (opsional, sebagai rujukan saat meninjau).</li>
          <li>Ekstraksi dijalankan di komputer pengembang, bukan di peramban: <code className="font-mono">npm run extract -- &quot;buku.pdf&quot; 2021</code>, lalu <code className="font-mono">npm run bank</code>. Hasilnya <code className="font-mono">data/bank.json</code> dan gambar di <code className="font-mono">public/soal/</code>.</li>
          <li>Unggah <code className="font-mono">bank.json</code> di sini. Semua soal masuk sebagai “Perlu ditinjau”.</li>
          <li>Buka tab Tinjauan: perbaiki teks, pilihan, diagram, dan kunci, lalu terbitkan satu per satu.</li>
        </ol>
      </Notice>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><FileJson className="size-5 text-brand-600" />Impor hasil ekstraksi</h2>
          <p className="mt-1 text-sm text-muted">Berkas JSON dari <code className="font-mono">npm run bank</code>. Soal dengan ID yang sama diperbarui dan dikembalikan ke status perlu ditinjau.</p>
          <input ref={json} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} />
          <Button className="mt-4" loading={busy === "json"} onClick={() => json.current?.click()}><FileUp className="size-4" />Pilih berkas JSON</Button>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><FileUp className="size-5 text-brand-600" />Arsip buku sumber (PDF)</h2>
          <p className="mt-1 text-sm text-muted">Hanya admin yang bisa membuka arsip ini. Maksimal 50 MB per berkas.</p>
          <input ref={pdf} type="file" accept="application/pdf" className="hidden" onChange={(e) => { uploadPdf(e.target.files?.[0]); e.target.value = ""; }} />
          <Button className="mt-4" variant="secondary" loading={busy === "pdf"} onClick={() => pdf.current?.click()}><FileUp className="size-4" />Unggah PDF</Button>
          <ul className="mt-4 divide-y divide-line text-sm">
            {(books ?? []).filter((b) => b.id).map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 truncate text-ink">{b.name}</span><button onClick={() => removeBook(b.name)} aria-label={`Hapus ${b.name}`} className="rounded p-1.5 text-bad hover:bg-bad-50"><Trash2 className="size-4" /></button></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Kompetisi */
const blank = { title: "", description: "", mode: "berwaktu" as Competition["mode"], duration_minutes: "30", question_count: "10", score_correct: "4", score_wrong: "0", score_blank: "0", topics: [] as string[], years: [] as number[], mix: {} as Record<string, string>, is_active: true };
type Form = typeof blank & { id?: string };

export function CompetitionsTab() {
  const { profile } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [results, setResults] = useState<Competition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, reload } = useQuery(async () => {
    const sb = supabase();
    const [comps, qs] = await Promise.all([sb.from("competitions").select("*").order("created_at"), sb.from("questions").select("year").eq("status", "published")]);
    return { comps: unwrap(comps) as Competition[], years: [...new Set((unwrap(qs) as { year: number | null }[]).map((q) => q.year).filter((y): y is number => y !== null))].sort() };
  }, []);

  const edit = (c: Competition) => setForm({
    id: c.id, title: c.title, description: c.description, mode: c.mode, duration_minutes: String(c.duration_minutes ?? ""), question_count: String(c.question_count),
    score_correct: String(c.score_correct), score_wrong: String(c.score_wrong), score_blank: String(c.score_blank), topics: c.topics, years: c.years,
    mix: Object.fromEntries(Object.entries(c.difficulty_mix ?? {}).map(([k, v]) => [k, String(v)])), is_active: c.is_active,
  });

  const save = async () => {
    if (!form) return;
    setError(null);
    const count = Number(form.question_count);
    const mix = Object.fromEntries(Object.entries(form.mix).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    if (!form.title.trim()) return setError("Judul wajib diisi.");
    if (!(count >= 1 && count <= 60)) return setError("Jumlah soal antara 1 dan 60.");
    if (form.mode !== "latihan" && !(Number(form.duration_minutes) >= 1)) return setError("Durasi wajib diisi untuk mode berwaktu.");
    if (Object.values(mix).reduce((s, n) => s + n, 0) > count) return setError("Jumlah komposisi kesulitan melebihi jumlah soal.");
    setBusy(true);
    const row = {
      title: form.title.trim(), description: form.description.trim(), mode: form.mode, duration_minutes: form.mode === "latihan" ? null : Number(form.duration_minutes), question_count: count,
      score_correct: Number(form.score_correct), score_wrong: Number(form.score_wrong), score_blank: Number(form.score_blank), topics: form.topics, years: form.years, difficulty_mix: mix, is_active: form.is_active,
    };
    const { error } = form.id ? await supabase().from("competitions").update(row).eq("id", form.id) : await supabase().from("competitions").insert({ ...row, created_by: profile!.id });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setForm(null);
    reload();
  };
  const remove = async (c: Competition) => {
    if (!window.confirm(`Hapus kompetisi "${c.title}" beserta seluruh hasil percobaannya?`)) return;
    await supabase().from("competitions").delete().eq("id", c.id);
    reload();
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (loading && !data) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setForm({ ...blank })}><Plus className="size-4" />Kompetisi baru</Button></div>
      {data?.comps.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="font-bold text-navy-900">{c.title} {!c.is_active && <Badge>Ditutup</Badge>}</p>
            <p className="text-sm text-muted">{COMPETITION_MODES[c.mode]} · {c.question_count} soal · {c.duration_minutes && c.mode !== "latihan" ? `${c.duration_minutes} menit` : "tanpa batas waktu"} · {scoringText(c)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setResults(c)}>Hasil</Button>
            <Button size="sm" variant="secondary" onClick={() => edit(c)}>Atur</Button>
            <Button size="sm" variant="ghost" className="text-bad" onClick={() => remove(c)}><Trash2 className="size-4" /></Button>
          </div>
        </Card>
      ))}

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? "Atur kompetisi" : "Kompetisi baru"}
        footer={<><Button variant="secondary" onClick={() => setForm(null)}>Batal</Button><Button onClick={save} loading={busy}>Simpan</Button></>}>
        {form && (
          <div className="space-y-4">
            <Field label="Judul"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Deskripsi"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Mode"><Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as Competition["mode"] })}>{Object.entries(COMPETITION_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Jumlah soal"><Input inputMode="numeric" value={form.question_count} onChange={(e) => setForm({ ...form, question_count: e.target.value })} /></Field>
              <Field label="Durasi (menit)"><Input inputMode="numeric" disabled={form.mode === "latihan"} value={form.mode === "latihan" ? "" : form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></Field>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Aturan nilai</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Benar"><Input inputMode="decimal" value={form.score_correct} onChange={(e) => setForm({ ...form, score_correct: e.target.value })} /></Field>
                <Field label="Salah" hint="Negatif = pengurangan nilai"><Input inputMode="decimal" value={form.score_wrong} onChange={(e) => setForm({ ...form, score_wrong: e.target.value })} /></Field>
                <Field label="Kosong"><Input inputMode="decimal" value={form.score_blank} onChange={(e) => setForm({ ...form, score_blank: e.target.value })} /></Field>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Komposisi kesulitan <span className="font-normal text-muted">(kosong = acak)</span></p>
              <div className="grid grid-cols-4 gap-2">{DIFFICULTIES.map((d) => <Field key={d} label={DIFFICULTY_NAMES[d]}><Input inputMode="numeric" value={form.mix[d] ?? ""} onChange={(e) => setForm({ ...form, mix: { ...form.mix, [d]: e.target.value.replace(/\D/g, "") } })} /></Field>)}</div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Topik <span className="font-normal text-muted">(kosong = semua)</span></p>
              <div className="flex flex-wrap gap-2">{Object.entries(TOPIC_NAMES).map(([k, v]) => <Chip key={k} active={form.topics.includes(k)} onClick={() => setForm({ ...form, topics: toggle(form.topics, k) })}>{v}</Chip>)}</div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Tahun soal <span className="font-normal text-muted">(kosong = semua)</span></p>
              <div className="flex flex-wrap gap-2">{data?.years.map((y) => <Chip key={y} active={form.years.includes(y)} onClick={() => setForm({ ...form, years: toggle(form.years, y) })}>{y}</Chip>)}</div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="size-4 accent-brand-600" />Terbuka untuk siswa</label>
            {error && <Notice tone="bad">{error}</Notice>}
          </div>
        )}
      </Modal>
      {results && <CompetitionResults competition={results} onClose={() => setResults(null)} />}
    </div>
  );
}

function CompetitionResults({ competition, onClose }: { competition: Competition; onClose: () => void }) {
  const { data, loading } = useQuery(async () => {
    const sb = supabase();
    const [res, students] = await Promise.all([
      sb.from("competition_results").select("session_id, user_id, score, max_score, accuracy, time_spent_seconds, created_at").eq("competition_id", competition.id).order("score", { ascending: false }).limit(200),
      sb.rpc("admin_students"),
    ]);
    const names = new Map((unwrap(students) as Student[]).map((s) => [s.id, s.username]));
    return (unwrap(res) as { session_id: string; user_id: string; score: number; max_score: number; accuracy: number; time_spent_seconds: number; created_at: string }[]).map((r) => ({ ...r, username: names.get(r.user_id) ?? "?" }));
  }, [competition.id]);
  return (
    <Modal open onClose={onClose} title={`Hasil: ${competition.title}`}>
      {loading || !data ? <Spinner /> : data.length ? (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line"><th className={th}>Siswa</th><th className={th}>Skor</th><th className={th}>Akurasi</th><th className={th}>Waktu</th><th className={th}>Tanggal</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.map((r) => <tr key={r.session_id}><td className={td}>@{r.username}</td><td className={`${td} tabular-nums`}>{Number(r.score)} / {Number(r.max_score)}</td><td className={`${td} tabular-nums`}>{Number(r.accuracy)}%</td><td className={`${td} tabular-nums`}>{formatDuration(r.time_spent_seconds)}</td><td className={`${td} text-muted`}>{formatDate(r.created_at)}</td></tr>)}
          </tbody>
        </table>
      ) : <p className="text-sm text-muted">Belum ada percobaan yang dikumpulkan.</p>}
    </Modal>
  );
}
