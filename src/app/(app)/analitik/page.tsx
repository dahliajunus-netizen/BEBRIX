"use client";

import { BarChart3, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/components/auth-provider";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, Spinner, Stat } from "@/components/ui";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { CompetitionResult, Difficulty } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_NAMES, formatDate, formatDuration, percent, todayWib, TOPIC_NAMES } from "@/lib/utils";

interface Answer { question_id: string; is_correct: boolean; time_spent_ms: number; created_at: string; mode: string; questions: { topic: string; difficulty: Difficulty } }
interface Day { day: string; questions_answered: number; correct: number; time_spent_ms: number }

const NAVY = "#12305a";
const BLUE = "#2360e0";
const CYAN = "#06b6d4";
const axis = { fontSize: 12, fill: "#586780" };
const tooltip = { contentStyle: { borderRadius: 12, border: "1px solid #e2e8f1", fontSize: 13 } };

const shortDay = (iso: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(`${iso}T12:00:00+07:00`));

export default function Analytics() {
  const { profile } = useAuth();
  const uid = profile!.id;

  const { data, loading, error } = useQuery(async () => {
    const sb = supabase();
    const [answers, days, results, comps] = await Promise.all([
      sb.from("student_answers").select("question_id, is_correct, time_spent_ms, created_at, mode, questions(topic, difficulty)").eq("user_id", uid).order("created_at"),
      sb.from("daily_activity").select("day, questions_answered, correct, time_spent_ms").eq("user_id", uid).order("day"),
      sb.from("competition_results").select("*").eq("user_id", uid).order("created_at"),
      sb.from("competitions").select("id, title"),
    ]);
    return {
      answers: unwrap(answers) as unknown as Answer[], days: unwrap(days) as Day[], results: unwrap(results) as CompetitionResult[],
      titles: new Map((unwrap(comps) as { id: string; title: string }[]).map((c) => [c.id, c.title])),
    };
  }, [uid]);

  const m = useMemo(() => {
    if (!data) return null;
    const { answers, days, results } = data;
    const total = answers.length;
    const correct = answers.filter((a) => a.is_correct).length;
    const byDay = new Map(days.map((d) => [d.day, d]));
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const day = todayWib(i - 29);
      const d = byDay.get(day);
      return { day: shortDay(day), soal: d?.questions_answered ?? 0, benar: d?.correct ?? 0 };
    });
    // Weekly totals for the last 8 weeks (Monday-based, WIB).
    const weeks: { week: string; soal: number; akurasi: number | null }[] = [];
    for (let w = 7; w >= 0; w--) {
      const ref = new Date(`${todayWib(-7 * w)}T12:00:00+07:00`);
      const monday = new Date(ref.getTime() - ((ref.getUTCDay() + 6) % 7) * 86400000);
      let n = 0, ok = 0;
      for (let d = 0; d < 7; d++) {
        const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(monday.getTime() + d * 86400000));
        n += byDay.get(key)?.questions_answered ?? 0;
        ok += byDay.get(key)?.correct ?? 0;
      }
      weeks.push({ week: shortDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(monday)), soal: n, akurasi: n ? percent(ok, n) : null });
    }
    let run = 0, runOk = 0;
    const cumulative = days.map((d) => { run += d.questions_answered; runOk += d.correct; return { day: shortDay(d.day), total: run, akurasi: percent(runOk, run) }; });

    const group = <K extends string>(key: (a: Answer) => K | undefined) => {
      const out = {} as Record<K, { n: number; ok: number }>;
      for (const a of answers) { const k = key(a); if (!k) continue; (out[k] ??= { n: 0, ok: 0 }).n++; if (a.is_correct) out[k].ok++; }
      return out;
    };
    const topics = group((a) => a.questions?.topic);
    const diffs = group((a) => a.questions?.difficulty);
    const topicRows = Object.keys(TOPIC_NAMES).map((t) => ({ topic: t, name: TOPIC_NAMES[t], n: topics[t]?.n ?? 0, akurasi: topics[t] ? percent(topics[t].ok, topics[t].n) : 0 }));
    const diffRows = DIFFICULTIES.map((d) => ({ name: DIFFICULTY_NAMES[d], n: diffs[d]?.n ?? 0, akurasi: diffs[d] ? percent(diffs[d].ok, diffs[d].n) : 0 }));

    // Trend per topic: the most recent half of the answers against the older half (needs 6+ answers).
    const trend = Object.keys(TOPIC_NAMES).map((t) => {
      const list = answers.filter((a) => a.questions?.topic === t);
      if (list.length < 6) return null;
      const half = Math.floor(list.length / 2);
      const acc = (xs: Answer[]) => percent(xs.filter((a) => a.is_correct).length, xs.length);
      return { topic: t, before: acc(list.slice(0, half)), after: acc(list.slice(half)) };
    }).filter((x): x is { topic: string; before: number; after: number } => x !== null);

    const rated = topicRows.filter((t) => t.n >= 3).sort((a, b) => b.akurasi - a.akurasi);
    const times = answers.filter((a) => a.mode !== "kompetisi" && a.time_spent_ms > 0).map((a) => a.time_spent_ms);
    const best = results.reduce<CompetitionResult | null>((b, r) => (!b || Number(r.accuracy) > Number(b.accuracy) ? r : b), null);
    return {
      total, correct, last30, weeks, cumulative, topicRows, diffRows, rated, trend,
      strongest: rated[0], weakest: rated.length > 1 ? rated[rated.length - 1] : undefined,
      improving: trend.filter((t) => t.after - t.before >= 10), slipping: trend.filter((t) => t.before - t.after >= 10),
      untouched: topicRows.filter((t) => t.n < 3),
      avgTime: times.length ? times.reduce((s, x) => s + x, 0) / times.length / 1000 : 0, best,
      distinct: new Set(answers.map((a) => a.question_id)).size,
    };
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error || !data || !m) return <Notice tone="bad" title="Analitik gagal dimuat">{error}</Notice>;
  if (m.total === 0)
    return (
      <div>
        <PageHeader title="Analitik" description="Semua angka di halaman ini dihitung dari jawabanmu sendiri." />
        <EmptyState icon={<BarChart3 className="size-5" />} title="Belum ada data" action={<ButtonLink href="/latihan">Mulai berlatih</ButtonLink>}>Analitik akan terisi setelah kamu menjawab soal pertamamu.</EmptyState>
      </div>
    );

  // Recommendations are plain rules over the numbers above. No rule fires without enough data.
  const tips: string[] = [];
  if (m.strongest && m.weakest && m.strongest.topic !== m.weakest.topic && m.strongest.akurasi - m.weakest.akurasi >= 10)
    tips.push(`Akurasi ${m.strongest.name} kamu kuat (${m.strongest.akurasi}%), tetapi ${m.weakest.name} masih ${m.weakest.akurasi}% dari ${m.weakest.n} jawaban. Coba kerjakan lima soal ${m.weakest.name} lagi.`);
  for (const t of m.slipping) tips.push(`Akurasi ${TOPIC_NAMES[t.topic]} turun dari ${t.before}% menjadi ${t.after}% pada jawaban terbarumu. Buka kembali modulnya sebelum lanjut berlatih.`);
  for (const t of m.improving) tips.push(`${TOPIC_NAMES[t.topic]} membaik: dari ${t.before}% menjadi ${t.after}%. Pertahankan dengan soal tingkat yang lebih sulit.`);
  if (m.untouched.length) tips.push(`Data untuk ${m.untouched.map((t) => t.name).join(", ")} masih kurang dari tiga jawaban. Kerjakan beberapa soal agar kekuatanmu di topik itu bisa diukur.`);
  const hard = m.diffRows.find((d) => d.name === "Sulit");
  const medium = m.diffRows.find((d) => d.name === "Sedang");
  if (medium && medium.n >= 8 && medium.akurasi >= 75 && (!hard || hard.n < 5)) tips.push(`Akurasi soal tingkat sedang sudah ${medium.akurasi}%. Saatnya mencoba latihan tingkat sulit.`);
  if (!data.results.length) tips.push("Kamu belum pernah mencoba simulasi kompetisi. Coba Tantangan Berwaktu untuk mengukur kecepatanmu.");

  return (
    <div className="space-y-4">
      <PageHeader title="Analitik" description="Semua angka di halaman ini dihitung dari jawabanmu sendiri." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Akurasi keseluruhan" value={`${percent(m.correct, m.total)}%`} hint={`${m.correct} benar dari ${m.total} jawaban`} />
        <Stat label="Soal berbeda" value={m.distinct} hint="yang pernah dikerjakan" />
        <Stat label="Rata-rata waktu" value={m.avgTime ? formatDuration(m.avgTime) : "–"} hint="per soal latihan" />
        <Stat label="Simulasi terbaik" value={m.best ? `${Number(m.best.accuracy)}%` : "–"} hint={m.best ? `${Number(m.best.score)} / ${Number(m.best.max_score)} poin` : "Belum ada percobaan"} />
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold text-navy-900"><Lightbulb className="size-5 text-cyan-600" />Kekuatan, kelemahan, dan rekomendasi</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Insight label="Topik terkuat" value={m.strongest ? `${m.strongest.name} · ${m.strongest.akurasi}%` : "Butuh 3+ jawaban per topik"} tone="good" />
          <Insight label="Topik terlemah" value={m.weakest ? `${m.weakest.name} · ${m.weakest.akurasi}%` : "Butuh data dari 2+ topik"} tone="bad" />
          <Insight label="Sedang membaik" value={m.improving.length ? m.improving.map((t) => TOPIC_NAMES[t.topic]).join(", ") : "Belum terlihat"} icon={<TrendingUp className="size-4" />} />
          <Insight label="Perlu latihan lagi" value={m.slipping.length ? m.slipping.map((t) => TOPIC_NAMES[t.topic]).join(", ") : m.untouched.length ? m.untouched.map((t) => t.name).join(", ") : "Tidak ada"} icon={<TrendingDown className="size-4" />} />
        </div>
        {tips.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink">
            {tips.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-500" />{t}</li>)}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Aktivitas harian" note="Jumlah soal per hari, 30 hari terakhir">
          <BarChart data={m.last30}><CartesianGrid vertical={false} stroke="#e2e8f1" /><XAxis dataKey="day" tick={axis} interval={5} tickLine={false} axisLine={false} /><YAxis tick={axis} allowDecimals={false} tickLine={false} axisLine={false} width={28} /><Tooltip {...tooltip} cursor={{ fill: "#f0f5ff" }} /><Bar dataKey="soal" name="Soal" fill={BLUE} radius={[4, 4, 0, 0]} /></BarChart>
        </ChartCard>
        <ChartCard title="Aktivitas mingguan" note="Jumlah soal per minggu, 8 minggu terakhir">
          <BarChart data={m.weeks}><CartesianGrid vertical={false} stroke="#e2e8f1" /><XAxis dataKey="week" tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} allowDecimals={false} tickLine={false} axisLine={false} width={28} /><Tooltip {...tooltip} cursor={{ fill: "#f0f5ff" }} /><Bar dataKey="soal" name="Soal" fill={NAVY} radius={[4, 4, 0, 0]} /></BarChart>
        </ChartCard>
        <ChartCard title="Soal terjawab dari waktu ke waktu" note="Jumlah kumulatif dan akurasi berjalan">
          <LineChart data={m.cumulative}><CartesianGrid vertical={false} stroke="#e2e8f1" /><XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} /><YAxis yAxisId="l" tick={axis} allowDecimals={false} tickLine={false} axisLine={false} width={32} /><YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={32} unit="%" /><Tooltip {...tooltip} /><Line yAxisId="l" type="monotone" dataKey="total" name="Total soal" stroke={BLUE} strokeWidth={2.5} dot={m.cumulative.length < 15} /><Line yAxisId="r" type="monotone" dataKey="akurasi" name="Akurasi %" stroke={CYAN} strokeWidth={2} dot={false} /></LineChart>
        </ChartCard>
        <ChartCard title="Akurasi per tingkat kesulitan" note="Persentase jawaban benar">
          <BarChart data={m.diffRows}><CartesianGrid vertical={false} stroke="#e2e8f1" /><XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={32} unit="%" /><Tooltip {...tooltip} cursor={{ fill: "#f0f5ff" }} formatter={(v, _n, p) => [`${v}% dari ${(p.payload as { n: number }).n} jawaban`, "Akurasi"]} /><Bar dataKey="akurasi" radius={[4, 4, 0, 0]}>{m.diffRows.map((d) => <Cell key={d.name} fill={d.n ? CYAN : "#e2e8f1"} />)}</Bar></BarChart>
        </ChartCard>
      </div>

      <ChartCard title="Akurasi per topik" note="Persentase jawaban benar pada tiap keterampilan berpikir komputasional" height={260}>
        <BarChart data={m.topicRows} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} stroke="#e2e8f1" /><XAxis type="number" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" /><YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={124} /><Tooltip {...tooltip} cursor={{ fill: "#f0f5ff" }} formatter={(v, _n, p) => [`${v}% dari ${(p.payload as { n: number }).n} jawaban`, "Akurasi"]} /><Bar dataKey="akurasi" radius={[0, 4, 4, 0]} barSize={18}>{m.topicRows.map((t) => <Cell key={t.topic} fill={t.n ? BLUE : "#e2e8f1"} />)}</Bar></BarChart>
      </ChartCard>

      <Card className="p-5">
        <h2 className="font-bold text-navy-900">Riwayat simulasi kompetisi</h2>
        {data.results.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint"><th className="py-2 pr-3 font-semibold">Kompetisi</th><th className="py-2 pr-3 font-semibold">Tanggal</th><th className="py-2 pr-3 font-semibold">Skor</th><th className="py-2 pr-3 font-semibold">Akurasi</th><th className="py-2 font-semibold">Waktu</th></tr></thead>
              <tbody className="divide-y divide-line">
                {[...data.results].reverse().map((r) => (
                  <tr key={r.session_id}>
                    <td className="py-2.5 pr-3 font-medium text-ink">{data.titles.get(r.competition_id) ?? "Kompetisi"} {m.best?.session_id === r.session_id && <Badge tone="good">Terbaik</Badge>}</td>
                    <td className="py-2.5 pr-3 text-muted">{formatDate(r.created_at)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{Number(r.score)} / {Number(r.max_score)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{Number(r.accuracy)}%</td>
                    <td className="py-2.5 tabular-nums text-muted">{formatDuration(r.time_spent_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-muted">Belum ada simulasi yang dikumpulkan.</p>}
      </Card>
    </div>
  );
}

function Insight({ label, value, tone, icon }: { label: string; value: string; tone?: "good" | "bad"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">{icon}{label}</p>
      <p className={tone === "good" ? "mt-1 font-semibold text-good" : tone === "bad" ? "mt-1 font-semibold text-bad" : "mt-1 font-semibold text-ink"}>{value}</p>
    </div>
  );
}

function ChartCard({ title, note, height = 220, children }: { title: string; note: string; height?: number; children: React.ReactElement }) {
  return (
    <Card className="p-5">
      <h2 className="font-bold text-navy-900">{title}</h2>
      <p className="text-xs text-muted">{note}</p>
      <div className="mt-4" style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </Card>
  );
}
