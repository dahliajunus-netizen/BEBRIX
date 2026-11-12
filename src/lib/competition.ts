import type { Competition } from "./types";

export const COMPETITION_MODES: Record<Competition["mode"], string> = {
  latihan: "Simulasi latihan",
  berwaktu: "Tantangan berwaktu",
  penuh: "Simulasi kompetisi penuh",
};

export function scoringText(c: Pick<Competition, "score_correct" | "score_wrong" | "score_blank">) {
  const f = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return `Benar ${f(Number(c.score_correct))} · Salah ${f(Number(c.score_wrong))} · Kosong ${f(Number(c.score_blank))}`;
}
