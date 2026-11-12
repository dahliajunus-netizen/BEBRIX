"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PracticeQuestion } from "@/components/question/question-card";
import { ButtonLink, EmptyState, Notice, Spinner } from "@/components/ui";
import { fetchQuestion, fetchReview } from "@/lib/data";
import { useQuery } from "@/lib/hooks";

/** One question on its own: used by the question bank, bookmarks and the daily challenge. */
export default function SingleQuestion() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const mode = params.get("mode") === "harian" ? "harian" : "bebas";

  const { data, loading, error } = useQuery(async () => {
    const [q, review] = await Promise.all([fetchQuestion(id), fetchReview(id).catch(() => null)]);
    return { q, review };
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <Notice tone="bad" title="Soal gagal dimuat">{error}</Notice>;
  if (!data?.q) return <EmptyState title="Soal tidak ditemukan" action={<ButtonLink href="/bank-soal">Ke bank soal</ButtonLink>}>Soal ini tidak ada atau belum diterbitkan.</EmptyState>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={mode === "harian" ? "/dasbor" : "/bank-soal"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-700">
        <ArrowLeft className="size-4" />{mode === "harian" ? "Kembali ke dasbor" : "Kembali ke bank soal"}
      </Link>
      {data.review && <Notice className="mb-4" title="Kamu sudah pernah mengerjakan soal ini">Jawaban terakhir dan pembahasannya ditampilkan. Tekan “Coba lagi” untuk mengerjakan ulang.</Notice>}
      <PracticeQuestion q={data.q} mode={mode} initial={data.review} />
    </div>
  );
}
