"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Badge, Card, PageHeader, Progress, Spinner } from "@/components/ui";
import { MODULE_ORDER, MODULES } from "@/content/modules";
import { unwrap, useQuery } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { percent, TOPIC_NAMES } from "@/lib/utils";

const MODULE_STEPS = ["konsep", "contoh", "demo", "latihan", "selesai"];

export default function Learn() {
  const { profile } = useAuth();
  const uid = profile!.id;
  const { data, loading } = useQuery(async () => {
    const sb = supabase();
    const [steps, qs] = await Promise.all([
      sb.from("lesson_progress").select("module, step").eq("user_id", uid),
      sb.from("questions").select("topic").eq("status", "published"),
    ]);
    const done: Record<string, Set<string>> = {};
    for (const s of unwrap(steps) as { module: string; step: string }[]) (done[s.module] ??= new Set()).add(s.step);
    const bank: Record<string, number> = {};
    for (const q of unwrap(qs) as { topic: string }[]) bank[q.topic] = (bank[q.topic] ?? 0) + 1;
    return { done, bank };
  }, [uid]);

  if (loading && !data) return <Spinner />;
  const finished = MODULE_ORDER.filter((m) => data?.done[m]?.has("selesai")).length;

  return (
    <div>
      <PageHeader title="Belajar" description="Enam modul berpikir komputasional. Setiap modul: konsep, contoh, demonstrasi interaktif, latihan terbimbing, lalu asesmen dengan soal Bebras asli." />
      <Card className="mb-5 p-5">
        <div className="flex items-center justify-between text-sm"><p className="font-semibold text-navy-900">Kemajuan belajar</p><p className="tabular-nums text-muted">{finished} dari {MODULE_ORDER.length} modul selesai</p></div>
        <Progress value={percent(finished, MODULE_ORDER.length)} tone="cyan" className="mt-2.5" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_ORDER.map((slug, i) => {
          const m = MODULES[slug];
          const steps = data?.done[slug] ?? new Set<string>();
          const count = MODULE_STEPS.filter((s) => steps.has(s)).length;
          const complete = steps.has("selesai");
          return (
            <Link key={slug} href={`/belajar/modul?m=${slug}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card hover:border-brand-500">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-navy-900 text-white"><m.icon className="size-5" /></span>
                {complete ? <Badge tone="good"><CheckCircle2 className="size-3.5" />Selesai</Badge> : count > 0 ? <Badge tone="brand">Sedang dipelajari</Badge> : <Badge>Belum dimulai</Badge>}
              </div>
              <p className="mt-4 text-xs font-bold text-faint">MODUL {i + 1}</p>
              <h2 className="text-lg font-bold text-navy-900">{TOPIC_NAMES[slug]}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{m.tagline}</p>
              <Progress value={percent(count, MODULE_STEPS.length)} className="mt-4" />
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{data?.bank[slug] ?? 0} soal Bebras untuk asesmen</span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-700">{count > 0 && !complete ? "Lanjutkan" : complete ? "Buka lagi" : "Mulai"}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
