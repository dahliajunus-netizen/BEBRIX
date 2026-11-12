"use client";

import { useState } from "react";
import { CompetitionsTab, ImportTab, OverviewTab, QuestionsTab, StudentsTab } from "@/components/admin/tabs";
import { useAuth } from "@/components/auth-provider";
import { Chip, Notice, PageHeader } from "@/components/ui";

const TABS = [
  ["ringkasan", "Ringkasan"],
  ["siswa", "Siswa"],
  ["soal", "Soal"],
  ["tinjauan", "Tinjauan"],
  ["impor", "Impor"],
  ["kompetisi", "Kompetisi"],
] as const;

/**
 * Administrator area. Hiding it for students is only a convenience: every query and
 * mutation here is enforced by Row Level Security and admin-only functions in the database.
 */
export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("ringkasan");
  if (profile!.role !== "admin") return <Notice tone="bad" title="Khusus administrator">Akunmu tidak memiliki akses ke halaman ini.</Notice>;
  return (
    <div>
      <PageHeader title="Admin" description="Kelola siswa, bank soal, impor buku, dan simulasi kompetisi." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([k, l]) => <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
      </div>
      {tab === "ringkasan" && <OverviewTab />}
      {tab === "siswa" && <StudentsTab />}
      {tab === "soal" && <QuestionsTab />}
      {tab === "tinjauan" && <QuestionsTab reviewOnly key="review" />}
      {tab === "impor" && <ImportTab />}
      {tab === "kompetisi" && <CompetitionsTab />}
    </div>
  );
}
