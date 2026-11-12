"use client";

import { EyeOff, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Avatar, Card, Chip, EmptyState, Notice, PageHeader, Spinner } from "@/components/ui";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Row { rank: number; user_id: string; username: string; avatar_url: string | null; grade: number | null; xp: number; best_score: number | null; is_me: boolean }
const PERIODS = [["weekly", "Minggu ini"], ["monthly", "Bulan ini"], ["all", "Sepanjang waktu"]] as const;

export default function Leaderboard() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("weekly");
  const { data, loading, error } = useQuery(async () => unwrap(await supabase().rpc("leaderboard", { p_period: period })) as Row[], [period]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Papan Peringkat" description="Peringkat dihitung dari XP yang benar-benar diperoleh siswa dalam periode yang dipilih. Yang ditampilkan hanya nama pengguna." />
      <div className="mb-4 flex flex-wrap gap-2">{PERIODS.map(([k, l]) => <Chip key={k} active={period === k} onClick={() => setPeriod(k)}>{l}</Chip>)}</div>
      {!profile!.leaderboard_visible && (
        <Notice tone="warn" className="mb-4" title="Kamu tersembunyi dari papan peringkat">
          <span className="inline-flex items-center gap-1.5"><EyeOff className="size-4" />Siswa lain tidak melihatmu. Ubah di <Link href="/profil" className="font-semibold underline">Profil</Link>.</span>
        </Notice>
      )}
      {loading ? <Spinner /> : error ? <Notice tone="bad">{error}</Notice> : !data?.length ? (
        <EmptyState icon={<Trophy className="size-5" />} title="Belum ada yang memperoleh XP pada periode ini">Jawab soal dengan benar untuk menjadi yang pertama di papan peringkat.</EmptyState>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {data.map((r) => (
            <div key={r.user_id} className={cn("flex items-center gap-3 px-4 py-3", r.is_me && "bg-brand-50")}>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                r.rank === 1 ? "bg-navy-900 text-white" : r.rank <= 3 ? "bg-brand-100 text-brand-700" : "text-muted")}>{r.rank}</span>
              <Avatar url={r.avatar_url} name={r.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">@{r.username}{r.is_me && <span className="ml-2 text-xs font-semibold text-brand-700">Kamu</span>}</p>
                <p className="text-xs text-muted">{r.grade ? `Kelas ${r.grade}` : "Kelas belum diisi"}{r.best_score !== null ? ` · simulasi terbaik ${Number(r.best_score)}%` : ""}</p>
              </div>
              <p className="shrink-0 text-right font-bold tabular-nums text-navy-900">{r.xp}<span className="ml-1 text-xs font-semibold text-faint">XP</span></p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
