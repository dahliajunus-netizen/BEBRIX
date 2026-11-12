"use client";

import { ArrowUp, Check, CornerUpLeft, CornerUpRight, Flag, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip } from "@/components/ui";
import { cn } from "@/lib/utils";

const ok = "border-good bg-good-50 text-good";
const no = "border-bad bg-bad-50 text-bad";

/* ------------------------------------------------------------------ Dekomposisi */
const GROUPS = ["Acara", "Perlengkapan", "Publikasi"] as const;
const TASKS: [string, number][] = [
  ["Menyusun urutan penampilan", 0], ["Meminjam pengeras suara", 1], ["Membuat poster", 2], ["Melatih pembawa acara", 0],
  ["Menata kursi penonton", 1], ["Mengumumkan di grup kelas", 2], ["Menyiapkan hadiah lomba", 1], ["Menentukan durasi tiap penampilan", 0],
];

export function DecompositionDemo() {
  const [pick, setPick] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const right = TASKS.filter(([, g], i) => pick[i] === g).length;
  return (
    <div>
      <p className="text-sm text-ink">Kelasmu akan mengadakan <strong>pentas seni</strong>. Pekerjaan sebesar itu lebih mudah jika dipecah menjadi tiga tim. Tentukan tim untuk setiap tugas.</p>
      <ul className="mt-4 space-y-2">
        {TASKS.map(([task, g], i) => (
          <li key={task} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2", checked && pick[i] !== undefined ? (pick[i] === g ? ok : no) : "border-line")}>
            <span className="text-sm font-medium text-ink">{task}</span>
            <span className="flex gap-1.5">{GROUPS.map((name, k) => <Chip key={name} active={pick[i] === k} onClick={() => { setPick({ ...pick, [i]: k }); setChecked(false); }}>{name}</Chip>)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setChecked(true)} disabled={Object.keys(pick).length < TASKS.length}>Periksa pembagian</Button>
        {checked && <p className="text-sm font-semibold text-ink">{right} dari {TASKS.length} tepat. {right === TASKS.length ? "Setiap tim kini punya daftar kerja yang jelas dan bisa dikerjakan bersamaan." : "Perbaiki baris yang merah."}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Pengenalan pola */
const SHAPES = { l: "●", k: "■", s: "▲" } as const;
type Tile = { s: keyof typeof SHAPES; c: string };
const B = "#2360e0", C = "#06b6d4", N = "#12305a";
const ROUNDS: { seq: Tile[]; options: Tile[]; answer: number; rule: string }[] = [
  { seq: [{ s: "l", c: B }, { s: "k", c: B }, { s: "l", c: B }, { s: "k", c: B }, { s: "l", c: B }], options: [{ s: "l", c: B }, { s: "k", c: B }, { s: "s", c: B }], answer: 1, rule: "Bentuk berselang-seling: lingkaran, persegi, lingkaran, persegi." },
  { seq: [{ s: "s", c: B }, { s: "s", c: C }, { s: "s", c: N }, { s: "s", c: B }, { s: "s", c: C }], options: [{ s: "s", c: B }, { s: "s", c: C }, { s: "s", c: N }], answer: 2, rule: "Bentuknya tetap, warnanya berulang setiap tiga: biru, toska, biru tua." },
  { seq: [{ s: "l", c: B }, { s: "k", c: C }, { s: "s", c: B }, { s: "l", c: C }, { s: "k", c: B }], options: [{ s: "s", c: B }, { s: "s", c: C }, { s: "l", c: C }], answer: 1, rule: "Dua pola berjalan bersamaan: bentuk berulang setiap tiga, warna berulang setiap dua." },
  { seq: [{ s: "l", c: N }, { s: "k", c: N }, { s: "k", c: N }, { s: "l", c: N }, { s: "k", c: N }, { s: "k", c: N }, { s: "k", c: N }, { s: "l", c: N }], options: [{ s: "l", c: N }, { s: "k", c: N }, { s: "s", c: N }], answer: 1, rule: "Jumlah persegi di antara lingkaran bertambah satu: 2, lalu 3, lalu 4." },
];

export function PatternDemo() {
  const [round, setRound] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const r = ROUNDS[round];
  const tile = (t: Tile, big = true) => <span style={{ color: t.c }} className={big ? "text-3xl leading-none" : "text-2xl leading-none"}>{SHAPES[t.s]}</span>;
  return (
    <div>
      <p className="text-sm text-ink">Pola {round + 1} dari {ROUNDS.length}. Bentuk apa yang muncul berikutnya?</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-canvas p-4">
        {r.seq.map((t, i) => <span key={i} className="flex size-12 items-center justify-center rounded-lg bg-surface shadow-card">{tile(t)}</span>)}
        <span className="flex size-12 items-center justify-center rounded-lg border-2 border-dashed border-brand-500 text-xl font-bold text-brand-600">?</span>
      </div>
      <div className="mt-4 flex gap-2">
        {r.options.map((t, i) => (
          <button key={i} onClick={() => setChoice(i)} disabled={choice !== null}
            className={cn("flex size-14 items-center justify-center rounded-xl border-2 bg-surface", choice === null ? "border-line hover:border-brand-500" : i === r.answer ? ok : i === choice ? no : "border-line opacity-50")}>
            {tile(t, false)}
          </button>
        ))}
      </div>
      {choice !== null && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink"><strong>{choice === r.answer ? "Tepat." : "Belum tepat."}</strong> {r.rule}</p>
          <Button size="sm" variant="secondary" onClick={() => { setRound((round + 1) % ROUNDS.length); setChoice(null); }}>{round === ROUNDS.length - 1 ? "Ulangi dari awal" : "Pola berikutnya"}</Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Abstraksi */
const LAYERS = [
  { id: "jalan", label: "Jalan mana saja yang tersambung", needed: true },
  { id: "jarak", label: "Panjang tiap jalan", needed: true },
  { id: "warna", label: "Warna cat bangunan", needed: false },
  { id: "pohon", label: "Jumlah pohon di tepi jalan", needed: false },
  { id: "nama", label: "Nama pemilik warung", needed: false },
];
const PLACES = [{ n: "Rumah", x: 40, y: 120 }, { n: "Warung", x: 150, y: 40 }, { n: "Taman", x: 160, y: 190 }, { n: "Sekolah", x: 290, y: 110 }];
const ROADS: [number, number, number][] = [[0, 1, 4], [0, 2, 3], [1, 3, 5], [2, 3, 4], [1, 2, 2]];

export function AbstractionDemo() {
  const [on, setOn] = useState<Record<string, boolean>>({ jalan: true, jarak: true, warna: true, pohon: true, nama: true });
  const [checked, setChecked] = useState(false);
  const correct = LAYERS.every((l) => Boolean(on[l.id]) === l.needed);
  return (
    <div>
      <p className="text-sm text-ink">Pertanyaan: <strong>berapa jarak terpendek dari Rumah ke Sekolah?</strong> Matikan semua informasi yang tidak diperlukan untuk menjawabnya.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
        <svg viewBox="0 0 330 230" className="w-full rounded-xl bg-canvas" role="img" aria-label="Peta sederhana empat tempat dan jalan penghubungnya">
          {on.jalan && ROADS.map(([a, b, d]) => (
            <g key={`${a}${b}`}>
              <line x1={PLACES[a].x} y1={PLACES[a].y} x2={PLACES[b].x} y2={PLACES[b].y} stroke="#8492a8" strokeWidth="3" />
              {on.jarak && <text x={(PLACES[a].x + PLACES[b].x) / 2 + 6} y={(PLACES[a].y + PLACES[b].y) / 2 - 6} fontSize="13" fontWeight="700" fill="#0b1f3a">{d}</text>}
              {on.pohon && <text x={(PLACES[a].x + PLACES[b].x) / 2 - 16} y={(PLACES[a].y + PLACES[b].y) / 2 + 16} fontSize="12">🌳🌳</text>}
            </g>
          ))}
          {PLACES.map((p, i) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r="17" fill={on.warna ? ["#f59e0b", "#ef4444", "#22c55e", "#8b5cf6"][i] : "#12305a"} />
              <text x={p.x} y={p.y + 34} textAnchor="middle" fontSize="12" fontWeight="600" fill="#0f1b2d">{p.n}{on.nama && p.n === "Warung" ? " Bu Sari" : ""}</text>
            </g>
          ))}
        </svg>
        <div className="space-y-2">
          {LAYERS.map((l) => (
            <label key={l.id} className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm", checked ? (Boolean(on[l.id]) === l.needed ? ok : no) : "border-line")}>
              <input type="checkbox" checked={Boolean(on[l.id])} onChange={(e) => { setOn({ ...on, [l.id]: e.target.checked }); setChecked(false); }} className="size-4 accent-brand-600" />
              <span className="text-ink">{l.label}</span>
            </label>
          ))}
          <Button className="w-full" onClick={() => setChecked(true)}>Periksa</Button>
        </div>
      </div>
      {checked && <p className="mt-3 text-sm text-ink">{correct ? "Tepat. Yang tersisa adalah titik, garis, dan angka: sebuah graf. Rute terpendeknya Rumah → Taman → Sekolah, 3 + 4 = 7." : "Belum tepat. Tanyakan pada tiap informasi: apakah jawabannya berubah jika informasi ini dihapus?"}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Algoritma */
const SIZE = 5;
const WALLS = new Set(["1,1", "1,2", "3,2", "3,3", "0,3"]);
const GOAL = { x: 4, y: 0 };
const START = { x: 0, y: 4, d: 0 }; // d: 0 up, 1 right, 2 down, 3 left
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
type Cmd = "maju" | "kiri" | "kanan";
const CMD: Record<Cmd, { label: string; icon: React.ReactNode }> = {
  maju: { label: "Maju", icon: <ArrowUp className="size-4" /> },
  kiri: { label: "Belok kiri", icon: <CornerUpLeft className="size-4" /> },
  kanan: { label: "Belok kanan", icon: <CornerUpRight className="size-4" /> },
};

export function AlgorithmDemo() {
  const [program, setProgram] = useState<Cmd[]>([]);
  const [robot, setRobot] = useState(START);
  const [step, setStep] = useState(-1);
  const [status, setStatus] = useState<"idle" | "run" | "win" | "crash" | "short">("idle");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const reset = () => { stop(); setRobot(START); setStep(-1); setStatus("idle"); };
  const run = () => {
    reset();
    let r = { ...START };
    let i = 0;
    setStatus("run");
    timer.current = setInterval(() => {
      if (i >= program.length) { stop(); setStatus(r.x === GOAL.x && r.y === GOAL.y ? "win" : "short"); return; }
      const c = program[i];
      if (c === "kiri") r = { ...r, d: (r.d + 3) % 4 };
      else if (c === "kanan") r = { ...r, d: (r.d + 1) % 4 };
      else {
        const nx = r.x + DX[r.d], ny = r.y + DY[r.d];
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || WALLS.has(`${nx},${ny}`)) { stop(); setStep(i); setStatus("crash"); return; }
        r = { ...r, x: nx, y: ny };
      }
      setRobot(r);
      setStep(i);
      i++;
    }, 380);
  };

  return (
    <div>
      <p className="text-sm text-ink">Susun perintah agar robot sampai ke bendera. Robot menjalankan perintah <strong>satu per satu, tepat sesuai urutan</strong>.</p>
      <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr]">
        <div className="grid w-fit gap-1" style={{ gridTemplateColumns: `repeat(${SIZE}, 2.75rem)` }}>
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const x = i % SIZE, y = Math.floor(i / SIZE);
            const wall = WALLS.has(`${x},${y}`);
            const here = robot.x === x && robot.y === y;
            return (
              <div key={i} className={cn("flex size-11 items-center justify-center rounded-lg", wall ? "bg-navy-800" : "bg-canvas", here && status === "crash" && "bg-bad-50")}>
                {here ? <ArrowUp className="size-6 text-brand-600 transition-transform" strokeWidth={3} style={{ transform: `rotate(${robot.d * 90}deg)` }} aria-label="Robot" /> : x === GOAL.x && y === GOAL.y ? <Flag className="size-5 text-cyan-600" aria-label="Tujuan" /> : null}
              </div>
            );
          })}
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CMD) as Cmd[]).map((c) => <Button key={c} size="sm" variant="secondary" disabled={status === "run" || program.length >= 16} onClick={() => { setProgram([...program, c]); reset(); }}>{CMD[c].icon}{CMD[c].label}</Button>)}
          </div>
          <ol className="mt-3 flex min-h-12 flex-wrap gap-1.5 rounded-xl border border-dashed border-line p-2">
            {program.length === 0 && <li className="p-1 text-sm text-faint">Programmu masih kosong.</li>}
            {program.map((c, i) => (
              <li key={i}>
                <button onClick={() => { setProgram(program.filter((_, k) => k !== i)); reset(); }} disabled={status === "run"} title="Hapus perintah ini"
                  className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold", i === step ? (status === "crash" ? no : "border-brand-600 bg-brand-50 text-brand-700") : "border-line text-ink")}>
                  {i + 1}. {CMD[c].label}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={run} disabled={!program.length || status === "run"}><Play className="size-4" />Jalankan</Button>
            <Button size="sm" variant="ghost" onClick={() => { setProgram([]); reset(); }}><RotateCcw className="size-4" />Kosongkan</Button>
          </div>
          <p className="mt-3 text-sm font-medium text-ink" aria-live="polite">
            {status === "win" && `Sampai di bendera dengan ${program.length} perintah. Bisakah lebih sedikit?`}
            {status === "crash" && `Robot menabrak pada perintah ke-${step + 1}. Telusuri posisinya langkah demi langkah, lalu perbaiki.`}
            {status === "short" && "Program habis sebelum robot sampai. Tambahkan perintah."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Representasi data */
const BITS = [16, 8, 4, 2, 1];

export function DataDemo() {
  const [bits, setBits] = useState([0, 0, 0, 0, 0]);
  const [target, setTarget] = useState(19);
  const value = bits.reduce((s, b, i) => s + b * BITS[i], 0);
  const next = () => { let t = target; while (t === target) t = 1 + Math.floor(Math.random() * 31); setTarget(t); setBits([0, 0, 0, 0, 0]); };
  return (
    <div>
      <p className="text-sm text-ink">Komputer menyimpan bilangan sebagai deretan lampu menyala (1) dan padam (0). Nyalakan lampu yang tepat untuk membentuk angka <strong className="text-lg text-brand-700">{target}</strong>.</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {BITS.map((w, i) => (
          <button key={w} onClick={() => setBits(bits.map((b, k) => (k === i ? 1 - b : b)))} aria-pressed={bits[i] === 1} aria-label={`Lampu bernilai ${w}`}
            className={cn("flex h-24 w-16 flex-col items-center justify-between rounded-xl border-2 py-2.5", bits[i] ? "border-cyan-500 bg-cyan-50" : "border-line bg-surface hover:border-brand-500")}>
            <span className="text-xs font-semibold text-muted">{w}</span>
            <span className={cn("size-7 rounded-full", bits[i] ? "bg-cyan-500 shadow-[0_0_14px_#06b6d4]" : "bg-line")} />
            <span className="font-mono text-lg font-bold text-navy-900">{bits[i]}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink">Kode biner: <code className="rounded bg-canvas px-1.5 py-0.5 font-mono font-bold">{bits.join("")}</code> = {bits.map((b, i) => (b ? BITS[i] : null)).filter(Boolean).join(" + ") || "0"} = <strong>{value}</strong></p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {value === target && <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check className="size-4" />Tepat. Hanya ada satu susunan lampu untuk setiap angka.</p>}
        <Button size="sm" variant="secondary" onClick={next}>Angka lain</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Penalaran logis */
const KIDS = ["Ani", "Budi", "Citra"];
const PETS = ["Kucing", "Ikan", "Kelinci"];
const SOLUTION = [1, 2, 0]; // Ani-Ikan, Budi-Kelinci, Citra-Kucing
const CLUES = ["Ani alergi bulu, jadi peliharaannya tidak berbulu.", "Peliharaan Budi bukan kucing.", "Setiap anak memelihara satu hewan yang berbeda."];

export function LogicDemo() {
  const [cell, setCell] = useState<Record<string, 0 | 1 | 2>>({}); // 0 kosong, 1 silang, 2 centang
  const [checked, setChecked] = useState(false);
  const solved = useMemo(() => KIDS.every((_, k) => PETS.every((_, p) => (cell[`${k}-${p}`] === 2) === (SOLUTION[k] === p))), [cell]);
  return (
    <div>
      <p className="text-sm text-ink">Siapa memelihara apa? Ketuk petak untuk memberi tanda silang (pasti bukan) atau centang (pasti ya). Gunakan petunjuk, jangan menebak.</p>
      <ol className="ml-5 mt-3 list-decimal space-y-1 text-sm text-ink">{CLUES.map((c) => <li key={c}>{c}</li>)}</ol>
      <div className="mt-4 overflow-x-auto">
        <table className="border-separate border-spacing-1.5">
          <thead><tr><th />{PETS.map((p) => <th key={p} className="px-2 text-xs font-semibold text-muted">{p}</th>)}</tr></thead>
          <tbody>
            {KIDS.map((kid, k) => (
              <tr key={kid}>
                <th className="pr-2 text-right text-sm font-semibold text-ink">{kid}</th>
                {PETS.map((pet, p) => {
                  const v = cell[`${k}-${p}`] ?? 0;
                  return (
                    <td key={pet}>
                      <button onClick={() => { setCell({ ...cell, [`${k}-${p}`]: ((v + 1) % 3) as 0 | 1 | 2 }); setChecked(false); }} aria-label={`${kid} dan ${pet}: ${["kosong", "bukan", "ya"][v]}`}
                        className={cn("flex size-12 items-center justify-center rounded-lg border-2", v === 2 ? "border-good bg-good-50 text-good" : v === 1 ? "border-line bg-canvas text-faint" : "border-line bg-surface hover:border-brand-500")}>
                        {v === 2 ? <Check className="size-5" /> : v === 1 ? <X className="size-5" /> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => setChecked(true)}>Periksa</Button>
        <Button size="sm" variant="ghost" onClick={() => { setCell({}); setChecked(false); }}><RotateCcw className="size-4" />Ulangi</Button>
        {checked && <p className="text-sm font-medium text-ink">{solved ? "Benar. Ani hanya bisa memelihara ikan, sehingga Budi tinggal punya pilihan kelinci, dan Citra kucing." : "Belum tepat. Mulai dari petunjuk 1: hewan mana yang tidak berbulu?"}</p>}
      </div>
    </div>
  );
}
