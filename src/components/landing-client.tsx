"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { ButtonLink } from "./ui";
import { isConfigured, supabase } from "@/lib/supabase";

export function LandingCta({ compact }: { compact?: boolean }) {
  const { session } = useAuth();
  if (session)
    return <ButtonLink href="/dasbor" size={compact ? "sm" : "lg"}>Buka dasbor <ArrowRight className="size-4" /></ButtonLink>;
  if (compact)
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/masuk" variant="ghost" size="sm">Masuk</ButtonLink>
        <ButtonLink href="/daftar" size="sm">Daftar</ButtonLink>
      </div>
    );
  return (
    <>
      <ButtonLink href="/daftar" size="lg">Mulai Berlatih <ArrowRight className="size-4" /></ButtonLink>
      <ButtonLink href="/masuk" variant="secondary" size="lg">Saya sudah punya akun</ButtonLink>
    </>
  );
}

/** Live numbers from the database (public_stats). Nothing is shown if they cannot be loaded. */
export function LandingStats() {
  const [stats, setStats] = useState<{ questions: number; years: number[]; topics: number } | null>(null);
  useEffect(() => {
    if (!isConfigured) return;
    supabase().rpc("public_stats").then(({ data }) => data && setStats(data));
  }, []);
  if (!stats || !stats.questions) return null;
  const years = stats.years.length ? `${stats.years[0]}–${stats.years[stats.years.length - 1]}` : "";
  return (
    <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
      {[
        [stats.questions, "soal asli Bebras"],
        [years, "tahun kompetisi"],
        [stats.topics, "modul belajar"],
      ].map(([v, l]) => (
        <div key={l as string}>
          <dt className="text-2xl font-extrabold tabular-nums text-navy-900">{v}</dt>
          <dd className="text-xs font-medium text-muted">{l}</dd>
        </div>
      ))}
    </dl>
  );
}
