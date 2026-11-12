"use client";

import { Clock, Flag, ListChecks, Scale, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, ButtonLink, Card, EmptyState, Notice, PageHeader, Spinner } from "@/components/ui";
import { COMPETITION_MODES, scoringText } from "@/lib/competition";
import { unwrap, useQuery } from "@/lib/hooks";
import { errorMessage, supabase } from "@/lib/supabase";
import type { Competition, CompetitionResult } from "@/lib/types";
import { DIFFICULTY_NAMES, formatDate, formatDuration, TOPIC_NAMES } from "@/lib/utils";

export default function Competitions() {
  const { profile } = useAuth();
  const router = useRouter();
  const uid = profile!.id;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useQuery(async () => {
    const sb = supabase();
    await sb.rpc("finalize_expired");
    const [comps, running, results] = await Promise.all([
      sb.from("competitions").select("*").eq("is_active", true).order("created_at"),
      sb.from("competition_sessions").select("id, competition_id").eq("user_id", uid).eq("status", "in_progress"),
      sb.from("competition_results").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
    ]);
    return {
      comps: unwrap(comps) as Competition[],
      running: new Map((unwrap(running) as { id: string; competition_id: string }[]).map((r) => [r.competition_id, r.id])),
      results: unwrap(results) as CompetitionResult[],
    };
  }, [uid]);

  const start = async (c: Competition) => {
    setBusy(c.id);
    setError(null);
    const { data: sid, error } = await supabase().rpc("start_competition", { p_competition: c.id });
    setBusy(null);
    if (error) return setError(errorMessage(error));
    router.push(`/kompetisi/sesi?id=${sid}`);
  };

  if (loading && !data) return <Spinner />;
  const titles = new Map(data?.comps.map((c) => [c.id, c.title]));

  return (
    <div>
      <PageHeader title="Simulasi Kompetisi" description="Berlatih dalam kondisi seperti Tantangan Bebras: soal dipilih otomatis, waktu berjalan, dan pembahasan baru terbuka setelah jawaban dikumpulkan." />
      {error && <Notice tone="bad" className="mb-4">{error}</Notice>}

      {data?.comps.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.comps.map((c) => {
            const runningId = data.running.get(c.id);
            const mix = Object.entries(c.difficulty_mix ?? {}).filter(([, n]) => n > 0);
            return (
              <Card key={c.id} className="flex flex-col p-5">
                <Badge tone={c.mode === "penuh" ? "brand" : c.mode === "berwaktu" ? "cyan" : "neutral"} className="self-start">{COMPETITION_MODES[c.mode]}</Badge>
                <h2 className="mt-3 text-lg font-bold text-navy-900">{c.title}</h2>
                <p className="mt-1 text-sm text-muted">{c.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-ink">
                  <li className="flex items-center gap-2"><ListChecks className="size-4 text-brand-600" />{c.question_count} soal</li>
                  <li className="flex items-center gap-2"><Timer className="size-4 text-brand-600" />{c.duration_minutes && c.mode !== "latihan" ? `${c.duration_minutes} menit, kumpul otomatis saat waktu habis` : "Tanpa batas waktu"}</li>
                  <li className="flex items-center gap-2"><Scale className="size-4 text-brand-600" />{scoringText(c)}</li>
                  {mix.length > 0 && <li className="text-xs text-muted">Komposisi: {mix.map(([d, n]) => `${n} ${DIFFICULTY_NAMES[d as keyof typeof DIFFICULTY_NAMES]?.toLowerCase() ?? d}`).join(", ")}</li>}
                  {c.topics.length > 0 && <li className="text-xs text-muted">Topik: {c.topics.map((t) => TOPIC_NAMES[t]).join(", ")}</li>}
                  {c.years.length > 0 && <li className="text-xs text-muted">Tahun: {c.years.join(", ")}</li>}
                </ul>
                <div className="mt-5 flex-1" />
                {runningId ? (
                  <ButtonLink href={`/kompetisi/sesi?id=${runningId}`} className="w-full">Lanjutkan percobaan</ButtonLink>
                ) : (
                  <Button onClick={() => start(c)} loading={busy === c.id} className="w-full"><Flag className="size-4" />Mulai</Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Flag className="size-5" />} title="Belum ada kompetisi aktif">Admin belum membuka simulasi kompetisi.</EmptyState>
      )}

      <Card className="mt-6 p-5">
        <h2 className="font-bold text-navy-900">Riwayat percobaan</h2>
        {data?.results.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pr-3 font-semibold">Kompetisi</th><th className="py-2 pr-3 font-semibold">Tanggal</th><th className="py-2 pr-3 font-semibold">Skor</th><th className="py-2 pr-3 font-semibold">Benar</th><th className="py-2 pr-3 font-semibold">Waktu</th><th />
              </tr></thead>
              <tbody className="divide-y divide-line">
                {data.results.map((r) => (
                  <tr key={r.session_id}>
                    <td className="py-2.5 pr-3 font-medium text-ink">{titles.get(r.competition_id) ?? "Kompetisi"}</td>
                    <td className="py-2.5 pr-3 text-muted">{formatDate(r.created_at, true)}</td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums">{Number(r.score)} / {Number(r.max_score)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{r.correct} ({Number(r.accuracy)}%)</td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted"><Clock className="mr-1 inline size-3.5" />{formatDuration(r.time_spent_seconds)}</td>
                    <td className="py-2.5 text-right"><ButtonLink href={`/kompetisi/hasil?id=${r.session_id}`} size="sm" variant="secondary">Hasil</ButtonLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-muted">Belum ada percobaan. Hasil simulasi akan tercatat di sini.</p>}
      </Card>
    </div>
  );
}
