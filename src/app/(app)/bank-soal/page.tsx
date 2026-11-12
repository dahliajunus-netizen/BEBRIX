"use client";

import { Bookmark, CheckCircle2, CircleDashed, Library, Play, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, Card, Chip, EmptyState, Input, Notice, PageHeader, Select, Spinner } from "@/components/ui";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Difficulty, Format, QuestionSummary } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_NAMES, FORMAT_NAMES, TOPIC_NAMES } from "@/lib/utils";

type Row = QuestionSummary & { category: string; search_text: string };
type Progress = "semua" | "belum" | "sudah" | "salah" | "disimpan";

export default function QuestionBank() {
  const { profile } = useAuth();
  const router = useRouter();
  const uid = profile!.id;
  const [years, setYears] = useState<number[]>([]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [format, setFormat] = useState("");
  const [category, setCategory] = useState("");
  const [progress, setProgress] = useState<Progress>("semua");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const { data, loading, error } = useQuery(async () => {
    const sb = supabase();
    const [qs, answers, marks] = await Promise.all([
      sb.from("questions").select("id, year, number, code, title, topic, difficulty, format, origin, status, category, search_text").eq("status", "published").order("year", { ascending: false }).order("number"),
      sb.from("student_answers").select("question_id, is_correct").eq("user_id", uid),
      sb.from("bookmarks").select("question_id").eq("user_id", uid),
    ]);
    const state = new Map<string, boolean>();
    for (const a of unwrap(answers) as { question_id: string; is_correct: boolean }[]) state.set(a.question_id, state.get(a.question_id) || a.is_correct);
    return { questions: unwrap(qs) as Row[], state, marks: new Set((unwrap(marks) as { question_id: string }[]).map((m) => m.question_id)) };
  }, [uid]);

  const allYears = useMemo(() => [...new Set((data?.questions ?? []).map((q) => q.year).filter((y): y is number => y !== null))].sort((a, b) => b - a), [data]);
  const categories = useMemo(() => [...new Set((data?.questions ?? []).map((q) => q.category))], [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.questions.filter((q) => {
      if (years.length && !years.includes(q.year ?? 0)) return false;
      if (topic && q.topic !== topic) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (format && q.format !== format) return false;
      if (category && q.category !== category) return false;
      const answered = data.state.has(q.id);
      if (progress === "belum" && answered) return false;
      if (progress === "sudah" && !answered) return false;
      if (progress === "salah" && (!answered || data.state.get(q.id))) return false;
      if (progress === "disimpan" && !data.marks.has(q.id)) return false;
      if (needle && !`${q.title} ${q.code ?? ""} ${q.search_text}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, years, topic, difficulty, format, category, progress, search]);

  const practise = async () => {
    setStarting(true);
    setStartError(null);
    const parts = [years.length ? `Bebras ${[...years].sort().join(", ")}` : "", topic ? TOPIC_NAMES[topic] : "", difficulty ? DIFFICULTY_NAMES[difficulty as Difficulty] : ""].filter(Boolean);
    const { data: sid, error } = await supabase().rpc("start_practice", {
      p_mode: "kustom",
      p_config: {
        years, topics: topic ? [topic] : [], difficulties: difficulty ? [difficulty] : [], formats: format ? [format] : [],
        only: progress === "belum" ? "unanswered" : progress === "salah" ? "incorrect" : progress === "disimpan" ? "bookmarked" : null,
        count: Math.min(filtered.length, 20), label: parts.join(" · ") || "Pilihan dari bank soal",
      },
    });
    setStarting(false);
    if (error) return setStartError(errorMessage(error));
    router.push(`/latihan/sesi?id=${sid}`);
  };

  if (loading && !data) return <Spinner />;
  if (error || !data) return <Notice tone="bad" title="Bank soal gagal dimuat">{error}</Notice>;

  return (
    <div>
      <PageHeader title="Bank Soal" description="Soal asli Tantangan Bebras Indonesia kategori Penggalang (SMP). Saring berdasarkan tahun, topik, tingkat kesulitan, format, atau status pengerjaanmu." />

      <Card className="p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, kode soal, atau kata dalam soal" className="pl-10" aria-label="Cari soal" />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Tahun kompetisi</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!years.length} onClick={() => setYears([])}>Semua tahun</Chip>
            {allYears.map((y) => (
              <Chip key={y} active={years.includes(y)} onClick={() => setYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y]))}>{y}</Chip>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topik">
            <option value="">Semua topik</option>
            {Object.entries(TOPIC_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Tingkat kesulitan">
            <option value="">Semua tingkat</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_NAMES[d]}</option>)}
          </Select>
          <Select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format soal">
            <option value="">Semua format</option>
            {(Object.keys(FORMAT_NAMES) as Format[]).map((f) => <option key={f} value={f}>{FORMAT_NAMES[f]}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategori kompetisi">
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={progress} onChange={(e) => setProgress(e.target.value as Progress)} aria-label="Status pengerjaan">
            <option value="semua">Semua status</option>
            <option value="belum">Belum dikerjakan</option>
            <option value="sudah">Sudah dikerjakan</option>
            <option value="salah">Belum pernah benar</option>
            <option value="disimpan">Disimpan</option>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted"><strong className="text-ink">{filtered.length}</strong> soal cocok dari {data.questions.length}</p>
          <Button onClick={practise} loading={starting} disabled={!filtered.length}><Play className="size-4" />Latih {Math.min(filtered.length, 20)} soal secara acak</Button>
        </div>
        {startError && <Notice tone="bad" className="mt-3">{startError}</Notice>}
      </Card>

      <div className="mt-5 space-y-2.5">
        {filtered.length === 0 ? (
          <EmptyState icon={<Library className="size-5" />} title="Tidak ada soal yang cocok">Ubah atau hapus sebagian saringan untuk melihat soal lain.</EmptyState>
        ) : (
          filtered.map((q) => {
            const answered = data.state.has(q.id);
            const right = data.state.get(q.id);
            return (
              <Link key={q.id} href={`/soal?id=${q.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-card hover:border-brand-500">
                <span className="shrink-0" title={answered ? (right ? "Sudah benar" : "Belum benar") : "Belum dikerjakan"}>
                  {answered ? (right ? <CheckCircle2 className="size-5 text-good" /> : <XCircle className="size-5 text-bad" />) : <CircleDashed className="size-5 text-faint" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-navy-900">{q.title}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{q.origin === "historical" ? `Bebras ${q.year}` : "Orisinal BEBRIX"}{q.code ? ` · ${q.code}` : ""}</Badge>
                    <Badge tone="cyan">{TOPIC_NAMES[q.topic]}</Badge>
                    <Badge>{DIFFICULTY_NAMES[q.difficulty]}</Badge>
                    <Badge>{FORMAT_NAMES[q.format]}</Badge>
                  </span>
                </span>
                {data.marks.has(q.id) && <Bookmark className="size-4 shrink-0 fill-brand-600 text-brand-600" aria-label="Disimpan" />}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
