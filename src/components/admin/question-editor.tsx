"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { AnswerInput } from "@/components/question/answer-input";
import { Figure } from "@/components/question/blocks";
import { QuestionBody } from "@/components/question/question-card";
import { Badge, Button, Card, Field, Input, Notice, Select, Spinner } from "@/components/ui";
import { QUESTION_SELECT } from "@/lib/data";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { AnswerKey, Block, Difficulty, Format, Question, Status } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_NAMES, FORMAT_NAMES, TOPIC_NAMES } from "@/lib/utils";

export const STATUS_NAMES: Record<Status, string> = { draft: "Draf", needs_review: "Perlu ditinjau", published: "Terbit", archived: "Diarsipkan" };
const area = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

interface OptionRow { label: string; text: string; image: { src: string; w: number; h: number } | null }
interface Draft {
  id: string; origin: "historical" | "original"; title: string; code: string; year: string; topic: string; difficulty: Difficulty; format: Format;
  status: Status; review_note: string; input_hint: string; rows: string; cols: string;
  stem: Block[]; options: OptionRow[]; correct: string; accepted: string; caseSensitive: boolean; explanation: Block[]; informatics: Block[];
}

/** Uploads a diagram to Storage and returns it as an image block. */
async function uploadImage(file: File, questionId: string): Promise<{ src: string; w: number; h: number }> {
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Berkas gambar tidak bisa dibaca."));
    img.src = URL.createObjectURL(file);
  });
  const path = `${questionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const sb = supabase();
  const { error } = await sb.storage.from("question-assets").upload(path, file, { contentType: file.type });
  if (error) throw error;
  await sb.from("question_assets").insert({ question_id: questionId, path, width: dims.w, height: dims.h });
  // Bundled diagrams are stored at 1.6× their display size; keep uploads on the same scale.
  return { src: sb.storage.from("question-assets").getPublicUrl(path).data.publicUrl, w: Math.round(dims.w * 1.6), h: Math.round(dims.h * 1.6) };
}

function BlockEditor({ label, blocks, onChange, questionId }: { label: string; blocks: Block[]; onChange: (b: Block[]) => void; questionId: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, b: Block) => onChange(blocks.map((x, k) => (k === i ? b : x)));
  const move = (i: number, d: number) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + d, 0, b);
    onChange(next);
  };
  const attach = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      onChange([...blocks, { type: "img", ...(await uploadImage(f, questionId)) }]);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{label}</p>
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-line p-2">
            <div className="min-w-0 flex-1">
              {b.type === "img" ? (
                <div className="overflow-x-auto"><Figure {...b} className="max-h-48 w-auto" /></div>
              ) : b.type === "table" ? (
                <textarea className={area} rows={3} value={b.rows.map((r) => r.join(" | ")).join("\n")} aria-label="Tabel: satu baris per baris, kolom dipisah |"
                  onChange={(e) => set(i, { type: "table", rows: e.target.value.split("\n").map((r) => r.split("|").map((c) => c.trim())) })} />
              ) : (
                <div className="flex gap-2">
                  <Select value={b.type} onChange={(e) => set(i, { type: e.target.value as "p" | "h" | "li", text: b.text })} className="h-9 w-32 shrink-0" aria-label="Jenis blok">
                    <option value="p">Paragraf</option><option value="h">Judul kecil</option><option value="li">Butir daftar</option>
                  </Select>
                  <textarea className={area} rows={Math.min(6, Math.max(1, Math.ceil(b.text.length / 90)))} value={b.text} onChange={(e) => set(i, { type: b.type, text: e.target.value })} aria-label="Teks" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naikkan" className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan" className="rounded p-1 text-muted hover:bg-canvas disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button type="button" onClick={() => onChange(blocks.filter((_, k) => k !== i))} aria-label="Hapus blok" className="rounded p-1 text-bad hover:bg-bad-50"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...blocks, { type: "p", text: "" }])}><Plus className="size-4" />Paragraf</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...blocks, { type: "table", rows: [["Kolom 1", "Kolom 2"], ["", ""]] }])}><Plus className="size-4" />Tabel</Button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => file.current?.click()}><ImagePlus className="size-4" />Unggah diagram</Button>
      </div>
      {error && <Notice tone="bad" className="mt-2">{error}</Notice>}
    </div>
  );
}

const toDraft = (q: Question, k: { key: AnswerKey | null; explanation: Block[]; informatics: Block[] } | null): Draft => ({
  id: q.id, origin: q.origin, title: q.title, code: q.code ?? "", year: q.year ? String(q.year) : "", topic: q.topic, difficulty: q.difficulty, format: q.format,
  status: q.status, review_note: q.review_note ?? "", input_hint: q.input_hint ?? "", rows: String(q.config?.rows ?? 4), cols: String(q.config?.cols ?? 4),
  stem: q.stem, options: q.question_options.map((o) => ({ label: o.label, text: o.text, image: o.image })),
  correct: (k?.key?.correct ?? []).join(", "), accepted: (k?.key?.accepted ?? []).join("\n"), caseSensitive: Boolean(k?.key?.caseSensitive),
  explanation: k?.explanation ?? [], informatics: k?.informatics ?? [],
});

export function emptyQuestionId() {
  return `bx-${Date.now().toString(36)}`;
}

/** Full editor for one question: content, options, verified key, explanation, status. */
export function QuestionEditor({ id, isNew, onClose }: { id: string; isNew?: boolean; onClose: (changed: boolean) => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading } = useQuery(async () => {
    if (isNew) {
      setD({ id, origin: "original", title: "", code: "", year: "", topic: "algoritma", difficulty: "sedang", format: "single_choice", status: "draft", review_note: "", input_hint: "", rows: "4", cols: "4",
        stem: [{ type: "p", text: "" }], options: ["A", "B", "C", "D"].map((label) => ({ label, text: "", image: null })), correct: "", accepted: "", caseSensitive: false, explanation: [], informatics: [] });
      return null;
    }
    const sb = supabase();
    const [q, k] = await Promise.all([
      sb.from("questions").select(QUESTION_SELECT).eq("id", id).maybeSingle(),
      sb.from("question_keys").select("key, explanation, informatics").eq("question_id", id).maybeSingle(),
    ]);
    const question = unwrap(q) as Question;
    question.question_options = [...question.question_options].sort((a, b) => a.sort - b.sort);
    const key = unwrap(k) as { key: AnswerKey | null; explanation: Block[]; informatics: Block[] } | null;
    // A proposed key is shown to the reviewer but never saved as verified without their action.
    if (key?.key?.proposed) {
      setProposed((key.key.correct ?? key.key.accepted ?? []).join(", "));
      key.key = null;
    }
    setD(toDraft(question, key));
    return null;
  }, [id, isNew]);

  if (loading || !d) return <Spinner />;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const choice = d.format !== "short_answer" && d.format !== "grid_select";
  const key: AnswerKey | null =
    d.format === "short_answer"
      ? d.accepted.trim() ? { accepted: d.accepted.split("\n").map((s) => s.trim()).filter(Boolean), caseSensitive: d.caseSensitive } : null
      : d.correct.trim() ? { correct: d.correct.split(",").map((s) => s.trim()).filter(Boolean) } : null;

  const preview: Question = {
    id: d.id, origin: d.origin, year: d.year ? Number(d.year) : null, number: null, code: d.code || null, code_note: null, title: d.title || "(tanpa judul)", country: null,
    category: "Penggalang (SMP)", topic: d.topic, difficulty: d.difficulty, format: d.format, stem: d.stem, config: { rows: Number(d.rows), cols: Number(d.cols) },
    input_hint: d.input_hint || null, original: [], pages: [], credit: null, status: d.status, review_note: null,
    question_options: d.options.map((o, i) => ({ ...o, sort: i + 1 })), question_sources: null,
  };

  const save = async (status: Status) => {
    setError(null);
    if (!d.title.trim()) return setError("Judul soal wajib diisi.");
    if (status === "published") {
      if (!key) return setError("Kunci jawaban wajib diisi dan diverifikasi sebelum soal diterbitkan.");
      if (choice && d.options.length < 2) return setError("Minimal dua pilihan jawaban.");
      if (choice && key.correct && !key.correct.every((c) => d.options.some((o) => o.label === c))) return setError("Kunci jawaban harus memakai huruf pilihan yang ada.");
    }
    setBusy(true);
    try {
      const sb = supabase();
      const row = {
        title: d.title.trim(), code: d.code.trim() || null, year: d.year ? Number(d.year) : null, topic: d.topic, difficulty: d.difficulty, format: d.format,
        stem: d.stem.filter((b) => b.type !== "p" || b.text.trim()), input_hint: d.input_hint.trim() || null, review_note: d.review_note.trim() || null,
        config: d.format === "grid_select" ? { rows: Number(d.rows), cols: Number(d.cols) } : {},
      };
      // Content first with a non-published status; the publish guard needs options and key in place.
      const hold: Status = status === "published" ? (isNew ? "draft" : d.status === "published" ? "needs_review" : d.status) : status;
      if (isNew) unwrap(await sb.from("questions").insert({ id: d.id, origin: "original", status: hold, ...row }).select("id"));
      else unwrap(await sb.from("questions").update({ ...row, status: hold }).eq("id", d.id).select("id"));
      unwrap(await sb.from("question_options").delete().eq("question_id", d.id).select("label"));
      if (choice && d.options.length)
        unwrap(await sb.from("question_options").insert(d.options.map((o, i) => ({ question_id: d.id, label: o.label.trim(), text: o.text, image: o.image, sort: i + 1 }))).select("label"));
      unwrap(await sb.from("question_keys").upsert({ question_id: d.id, key, explanation: d.explanation, informatics: d.informatics }).select("question_id"));
      if (status === "published") unwrap(await sb.from("questions").update({ status: "published" }).eq("id", d.id).select("id"));
      onClose(true);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm(`Hapus soal "${d.title}" secara permanen? Jawaban siswa untuk soal ini ikut terhapus.`)) return;
    setBusy(true);
    const { error } = await supabase().from("questions").delete().eq("id", d.id);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    onClose(true);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-navy-900">{isNew ? "Soal baru" : `Sunting ${d.id}`}</h2>
          <div className="flex gap-1.5"><Badge tone={d.origin === "historical" ? "brand" : "warn"}>{d.origin === "historical" ? "Soal historis" : "Soal orisinal"}</Badge><Badge>{STATUS_NAMES[d.status]}</Badge></div>
        </div>
        {d.review_note && <Notice tone="warn" title="Catatan tinjauan">{d.review_note}</Notice>}
        {proposed && <Notice tone="warn" title="Kunci usulan, belum terverifikasi">Usulan dari proses impor: <strong>{proposed}</strong>. Cocokkan dengan buku sumber, lalu isi kolom kunci jawaban sendiri.</Notice>}

        <Field label="Judul"><Input value={d.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode soal"><Input value={d.code} onChange={(e) => set("code", e.target.value)} placeholder="mis. 2020-AT-03" /></Field>
          <Field label="Tahun kompetisi" hint={d.origin === "original" ? "Kosongkan untuk soal orisinal." : undefined}><Input value={d.year} inputMode="numeric" onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} disabled={d.origin === "historical"} /></Field>
          <Field label="Topik"><Select value={d.topic} onChange={(e) => set("topic", e.target.value)}>{Object.entries(TOPIC_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Tingkat kesulitan"><Select value={d.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)}>{DIFFICULTIES.map((x) => <option key={x} value={x}>{DIFFICULTY_NAMES[x]}</option>)}</Select></Field>
          <Field label="Format"><Select value={d.format} onChange={(e) => set("format", e.target.value as Format)}>{(Object.keys(FORMAT_NAMES) as Format[]).map((f) => <option key={f} value={f}>{FORMAT_NAMES[f]}</option>)}</Select></Field>
          {d.format === "grid_select" && <div className="grid grid-cols-2 gap-3"><Field label="Baris"><Input value={d.rows} inputMode="numeric" onChange={(e) => set("rows", e.target.value)} /></Field><Field label="Kolom"><Input value={d.cols} inputMode="numeric" onChange={(e) => set("cols", e.target.value)} /></Field></div>}
        </div>

        <BlockEditor label="Isi soal" blocks={d.stem} onChange={(b) => set("stem", b)} questionId={d.id} />

        {choice && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{d.format === "ordering" ? "Butir yang diurutkan" : "Pilihan jawaban"}</p>
            <div className="space-y-2">
              {d.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={o.label} onChange={(e) => set("options", d.options.map((x, k) => (k === i ? { ...x, label: e.target.value.toUpperCase().slice(0, 2) } : x)))} className="w-14 text-center font-bold" aria-label="Huruf pilihan" />
                  <Input value={o.text} onChange={(e) => set("options", d.options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} placeholder={o.image ? "Pilihan berupa gambar" : "Teks pilihan (kosongkan jika huruf mengacu ke gambar soal)"} aria-label={`Teks pilihan ${o.label}`} />
                  <button type="button" onClick={() => set("options", d.options.filter((_, k) => k !== i))} aria-label="Hapus pilihan" className="rounded p-2 text-bad hover:bg-bad-50"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => set("options", [...d.options, { label: "ABCDEFGH"[d.options.length] ?? "", text: "", image: null }])}><Plus className="size-4" />Pilihan</Button>
          </div>
        )}

        {d.format === "short_answer" ? (
          <>
            <Field label="Jawaban yang diterima" hint="Satu jawaban per baris. Spasi diabaikan saat memeriksa."><textarea className={area} rows={3} value={d.accepted} onChange={(e) => set("accepted", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={d.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} className="size-4 accent-brand-600" />Huruf besar dan kecil dibedakan</label>
            <Field label="Petunjuk pengisian (opsional)"><Input value={d.input_hint} onChange={(e) => set("input_hint", e.target.value)} /></Field>
          </>
        ) : (
          <Field label="Kunci jawaban" hint={d.format === "ordering" ? "Huruf sesuai urutan yang benar, dipisah koma. Contoh: C, A, B" : d.format === "grid_select" ? "Petak yang benar sebagai baris-kolom, dipisah koma. Contoh: 1-2, 3-4" : d.format === "multiple_choice" ? "Semua huruf yang benar, dipisah koma." : "Satu huruf pilihan."}>
            <Input value={d.correct} onChange={(e) => set("correct", e.target.value.toUpperCase())} />
          </Field>
        )}

        <BlockEditor label="Pembahasan" blocks={d.explanation} onChange={(b) => set("explanation", b)} questionId={d.id} />
        <BlockEditor label="Konsep informatika (opsional)" blocks={d.informatics} onChange={(b) => set("informatics", b)} questionId={d.id} />
        <Field label="Catatan tinjauan (hanya untuk admin)"><textarea className={area} rows={2} value={d.review_note} onChange={(e) => set("review_note", e.target.value)} /></Field>

        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button onClick={() => save("published")} loading={busy}>Verifikasi dan terbitkan</Button>
          <Button variant="secondary" onClick={() => save(d.status === "published" ? "needs_review" : d.status)} disabled={busy}>{d.status === "published" ? "Simpan dan tarik dari terbit" : "Simpan tanpa menerbitkan"}</Button>
          {!isNew && <Button variant="secondary" onClick={() => save("archived")} disabled={busy}>Arsipkan</Button>}
          <Button variant="ghost" onClick={() => onClose(false)} disabled={busy}>Batal</Button>
          {!isNew && <Button variant="ghost" className="ml-auto text-bad" onClick={remove} disabled={busy}><Trash2 className="size-4" />Hapus</Button>}
        </div>
      </Card>

      <Card className="h-fit p-5 xl:sticky xl:top-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-faint">Pratinjau tampilan siswa</p>
        <QuestionBody q={preview} />
        <div className="mt-5 border-t border-line pt-4"><AnswerInput question={preview} value={{}} onChange={() => {}} disabled reveal={key} /></div>
      </Card>
    </div>
  );
}
