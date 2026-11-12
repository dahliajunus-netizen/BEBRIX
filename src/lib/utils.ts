import clsx, { type ClassValue } from "clsx";
import type { Difficulty, Format } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export const TOPIC_NAMES: Record<string, string> = {
  dekomposisi: "Dekomposisi",
  pola: "Pengenalan Pola",
  abstraksi: "Abstraksi",
  algoritma: "Algoritma",
  "representasi-data": "Representasi Data",
  "penalaran-logis": "Penalaran Logis",
};

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit", lanjutan: "Lanjutan" };
export const DIFFICULTIES = Object.keys(DIFFICULTY_NAMES) as Difficulty[];

export const FORMAT_NAMES: Record<Format, string> = {
  single_choice: "Pilihan ganda",
  multiple_choice: "Pilih beberapa",
  short_answer: "Isian singkat",
  ordering: "Mengurutkan",
  grid_select: "Petak interaktif",
};

export const MODE_NAMES: Record<string, string> = {
  bebas: "Bank soal",
  topik: "Latihan topik",
  tahun: "Latihan per tahun",
  acak: "Latihan acak",
  kesulitan: "Latihan tingkat kesulitan",
  kelemahan: "Latihan kelemahan",
  kustom: "Latihan kustom",
  modul: "Asesmen modul",
  harian: "Tantangan harian",
  kompetisi: "Simulasi kompetisi",
};

/** Level curve: level n starts at 50·(n−1)² XP. */
export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, start, next, progress: (xp - start) / (next - start) };
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} j ${m} mnt`;
  if (m > 0) return `${m} mnt ${s % 60} dtk`;
  return `${s} dtk`;
}

export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export const percent = (part: number, total: number) => (total > 0 ? Math.round((100 * part) / total) : 0);

export function formatDate(iso: string, withTime = false) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

/** yyyy-mm-dd for "today" in WIB, matching the server's today_wib(). */
export function todayWib(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

/** Question diagrams are either bundled (/soal/...) or uploaded to Supabase Storage (full URL). */
export const assetUrl = (src: string) => src;
