"use client";

import { CalendarCheck, CalendarRange, Crosshair, Gauge, Layers, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button, ButtonLink, Card, Chip, Notice, PageHeader, Progress, Spinner } from "@/components/ui";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Difficulty } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_NAMES, formatDate, MODE_NAMES, percent, TOPIC_NAMES } from "@/lib/utils";

interface AnswerRow { mode: string; is_correct: boolean; questions: { topic: string } }
interface SessionRow { id: string; mode: string; label: string; question_ids: string[]; current_index: number; status: string; started_at: string }

export default function Practice() {
  const { profile } = useAuth();
  const router = useRouter();
  const uid = profile!.id;
  const [count, setCount] = useState(10);
  const [topic, setTopic] = useState("algoritma");
  const [years, setYears] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useQuery(async () => {
    const sb = supabase();
    const [qs, answers, sessions, daily] = await Promise.all([
      sb.from("questions").select("year, topic, difficulty").eq("status", "published"),
      sb.from("student_answers").select("mode, is_correct, questions(topic)").eq("user_id", uid),
      sb.from("practice_sessions").select("id, mode, label, question_ids, current_index, status, started_at").eq("user_id", uid).order("started_at", { ascending: false }).limit(6),
      sb.rpc("get_daily_challenge"),
    ]);
    return {
      questions: unwrap(qs) as { year: number; topic: string; difficulty: Difficulty }[],
      answers: unwrap(answers) as unknown as AnswerRow[],
      sessions: unwrap(sessions) as SessionRow[],
      daily: daily.data as string | null,
    };
  }, [uid]);

  const info = useMemo(() => {
    const qs = data?.questions ?? [];
    const countBy = (key: "year" | "topic" | "difficulty") => qs.reduce<Record<string, number>>((m, q) => ((m[q[key]] = (m[q[key]] ?? 0) + 1), m), {});
    const perMode: Record<string, { n: number; ok: number }> = {};
    const perTopic: Record<string, { n: number; ok: number }> = {};
    for (const a of data?.answers ?? []) {
      (perMode[a.mode] ??= { n: 0, ok: 0 }).n++;
      if (a.is_correct) perMode[a.mode].ok++;
      const t = a.questions?.topic;
      if (t) { (perTopic[t] ??= { n: 0, ok: 0 }).n++; if (a.is_correct) perTopic[t].ok++; }
    }
    const weakest = Object.entries(perTopic).filter(([, v]) => v.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
    return { years: countBy("year"), topics: countBy("topic"), diffs: countBy("difficulty"), perMode, weakest };
  }, [data]);

  const start = async (mode: string, config: Record<string, unknown>) => {
    setBusy(mode);
    setError(null);
    const { data: sid, error } = await supabase().rpc("start_practice", { p_mode: mode, p_config: { count, ...config } });
    setBusy(null);
    if (error) return setError(errorMessage(error));
    router.push(`/latihan/sesi?id=${sid}`);
  };

  if (loading && !data) return <Spinner />;
  const yearList = Object.keys(info.years).map(Number).sort((a, b) => b - a);

  return (
    <div>
      <PageHeader title="Latihan" description="Pilih cara berlatih. Setiap sesi tersimpan otomatis dan bisa dilanjutkan kapan saja."
        actions={<div className="flex items-center gap-2 text-sm text-muted">Jumlah soal{[5, 10, 15, 20].map((n) => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}</div>} />
      {error && <Notice tone="bad" className="mb-4">{error}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <ModeCard icon={<Layers className="size-5" />} title="Latihan topik" text="Fokus pada satu keterampilan berpikir komputasional.">
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOPIC_NAMES).map(([k, v]) => <Chip key={k} active={topic === k} onClick={() => setTopic(k)}>{v} <span className="opacity-60">{info.topics[k] ?? 0}</span></Chip>)}
          </div>
          <Button className="mt-4" loading={busy === "topik"} onClick={() => start("topik", { topics: [topic], label: `Topik: ${TOPIC_NAMES[topic]}` })}>Mulai latihan {TOPIC_NAMES[topic]}</Button>
        </ModeCard>

        <ModeCard icon={<CalendarRange className="size-5" />} title="Latihan per tahun" text="Kerjakan soal dari satu atau beberapa tahun kompetisi, berurutan seperti di bukunya.">
          <div className="flex flex-wrap gap-2">
            <Chip active={!years.length} onClick={() => setYears([])}>Semua tahun</Chip>
            {yearList.map((y) => <Chip key={y} active={years.includes(y)} onClick={() => setYears((v) => (v.includes(y) ? v.filter((x) => x !== y) : [...v, y]))}>{y} <span className="opacity-60">{info.years[y]}</span></Chip>)}
          </div>
          <Button className="mt-4" loading={busy === "tahun"} onClick={() => start("tahun", { years, label: years.length ? `Bebras ${[...years].sort().join(", ")}` : "Bebras semua tahun" })}>Mulai latihan per tahun</Button>
        </ModeCard>

        <ModeCard icon={<Gauge className="size-5" />} title="Latihan tingkat kesulitan" text="Naikkan tantangan secara bertahap, dari mudah sampai lanjutan.">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{DIFFICULTY_NAMES[d]} <span className="opacity-60">{info.diffs[d] ?? 0}</span></Chip>)}
          </div>
          <Button className="mt-4" loading={busy === "kesulitan"} onClick={() => start("kesulitan", { difficulties: [difficulty], label: `Tingkat ${DIFFICULTY_NAMES[difficulty]}` })}>Mulai tingkat {DIFFICULTY_NAMES[difficulty]}</Button>
        </ModeCard>

        <ModeCard icon={<Crosshair className="size-5" />} title="Latihan kelemahan" text="Soal dipilih otomatis dari topik dengan akurasi terendahmu, mendahulukan soal yang belum pernah kamu jawab benar.">
          <p className="text-sm text-ink">
            {info.weakest
              ? <>Topik terlemahmu saat ini: <strong>{TOPIC_NAMES[info.weakest[0]]}</strong> ({percent(info.weakest[1].ok, info.weakest[1].n)}% dari {info.weakest[1].n} jawaban).</>
              : "Belum cukup data untuk menentukan kelemahanmu. Sesi ini akan memakai campuran topik sampai datamu terkumpul."}
          </p>
          <Button className="mt-4" loading={busy === "kelemahan"} onClick={() => start("kelemahan", { label: "Latihan kelemahan" })}>Mulai latihan kelemahan</Button>
        </ModeCard>

        <ModeCard icon={<Shuffle className="size-5" />} title="Latihan acak" text="Campuran soal dari seluruh bank soal, seperti kompetisi sungguhan.">
          <Button loading={busy === "acak"} onClick={() => start("acak", { label: "Latihan acak" })}>Mulai latihan acak</Button>
        </ModeCard>

        <ModeCard icon={<CalendarCheck className="size-5" />} title="Tantangan harian" text="Satu soal baru setiap hari dengan bonus XP untuk menyelesaikannya.">
          {data?.daily ? <ButtonLink href={`/soal?id=${data.daily}&mode=harian`}>Kerjakan soal hari ini</ButtonLink> : <p className="text-sm text-muted">Belum ada soal terbit.</p>}
        </ModeCard>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Sesi terakhir</h2>
          {data?.sessions.length ? (
            <ul className="mt-3 divide-y divide-line">
              {data.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{s.label || MODE_NAMES[s.mode]}</p>
                    <p className="text-xs text-muted">{formatDate(s.started_at, true)} · {s.question_ids.length} soal · {s.status === "completed" ? "selesai" : `soal ${s.current_index + 1}`}</p>
                  </div>
                  <ButtonLink href={`/latihan/sesi?id=${s.id}`} size="sm" variant="secondary">{s.status === "completed" ? "Tinjau" : "Lanjutkan"}</ButtonLink>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Belum ada sesi latihan.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold text-navy-900">Akurasi per mode latihan</h2>
          {Object.keys(info.perMode).length ? (
            <ul className="mt-3 space-y-3">
              {Object.entries(info.perMode).sort((a, b) => b[1].n - a[1].n).map(([m, v]) => (
                <li key={m}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-ink">{MODE_NAMES[m] ?? m}</span><span className="tabular-nums text-muted">{percent(v.ok, v.n)}% · {v.n} jawaban</span></div>
                  <Progress value={percent(v.ok, v.n)} className="mt-1.5" />
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Akurasi tiap mode akan muncul setelah kamu mulai menjawab soal.</p>}
        </Card>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
        <div><h2 className="font-bold text-navy-900">{title}</h2><p className="text-sm text-muted">{text}</p></div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
