// Merges data/extracted/*.json with the manually verified data/overrides.json and writes
// data/bank.json, the import payload for the database (see scripts/seed.mjs).
//
// A question is only marked "published" when it has a verified answer key. Everything else
// is emitted as "needs_review" and stays invisible to students until an admin approves it.
import fs from "node:fs";

const SOURCES = {
  2016: { title: "Bebras Indonesia Challenge 2016 — Kelompok Penggalang", license: "CC BY-SA 3.0", file: "Bebras-Challenge-2016_Penggalang.pdf" },
  2017: { title: "Tantangan Bebras Indonesia 2017 — Tingkat SMP (Penggalang)", license: "CC BY-NC-SA 4.0", file: "BukuBebras2017_SMP.pdf" },
  2018: { title: "Tantangan Bebras Indonesia 2018 — Tingkat SMP (Penggalang)", license: "CC BY-NC-SA 4.0", file: "BukuBebras2018 SMP v.5.pdf" },
  2019: { title: "Tantangan Bebras Indonesia 2019 — Kategori Penggalang", license: "CC BY-NC-SA 4.0", file: "Bebras-Indonesia-Book-2019-SMP-v.Okt_.2024.pdf" },
  2020: { title: "Tantangan Bebras Indonesia 2020 — Kategori Penggalang", license: "CC BY-NC-SA 4.0", file: "Bebras-Indonesia-Book-2020-SMP-OK-Okt2024.pdf" },
};
const TOPIC = { D: "dekomposisi", P: "pola", A: "abstraksi", G: "algoritma", R: "representasi-data", L: "penalaran-logis" };
const DIFF = { 1: "mudah", 2: "sedang", 3: "sulit", 4: "lanjutan" };

const ov = JSON.parse(fs.readFileSync("data/overrides.json", "utf8"));
const classify = Object.fromEntries(ov.classify.split(/\s+/).map((s) => s.split(":")).map(([id, t, d]) => [id, { t, d }]));

const bank = [];
const report = [];
for (const year of Object.keys(SOURCES).map(Number)) {
  const qs = JSON.parse(fs.readFileSync(`data/extracted/${year}.json`, "utf8"));
  for (const q of qs) {
    const o = ov.questions[q.id] ?? {};
    const cls = classify[q.id];
    if (!cls) throw new Error(`Belum diklasifikasi: ${q.id}`);

    let options = q.options;
    if (o.optionLabels) options = [...o.optionLabels].map((label) => ({ label, text: "" }));
    if (o.options) options = o.options.map((text, i) => ({ label: "ABCDEFGH"[i], text }));

    let stem = q.stem;
    if (o.dropStemText) stem = stem.filter((b) => b.type === "img" || !o.dropStemText.includes(b.text));
    let informatics = q.informatics;
    let explanation = q.explanation;
    if (o.dropTrailingImages) {
      const cut = (blocks, n) => {
        const out = [...blocks];
        while (n > 0 && out.length && out[out.length - 1].type === "img") {
          out.pop();
          n--;
        }
        return out;
      };
      if (o.dropTrailingImages.informatics) informatics = cut(informatics, o.dropTrailingImages.informatics);
      if (o.dropTrailingImages.explanation) explanation = cut(explanation, o.dropTrailingImages.explanation);
    }

    let format = o.format ?? (options.length ? "single_choice" : "short_answer");
    let key = null;
    const answer = o.answer ?? (options.length && q.answer ? [q.answer] : null);
    if (format === "short_answer") {
      const accepted = o.accepted ?? (q.answer && !options.length ? [q.answer] : null);
      if (accepted) key = { accepted, caseSensitive: !!o.caseSensitive };
    } else if (answer) {
      if (!answer.every((a) => options.some((op) => op.label === a))) throw new Error(`Kunci di luar pilihan: ${q.id}`);
      key = { correct: answer };
    }

    const problems = [];
    if (o.review) problems.push(o.review);
    if (!key) problems.push("Kunci jawaban belum terverifikasi.");
    if (!stem.length) problems.push("Teks soal kosong.");
    if (format !== "short_answer" && options.length < 2) problems.push("Pilihan jawaban tidak lengkap.");
    const status = problems.length ? "needs_review" : "published";

    const code = "code" in o ? o.code : q.code;
    bank.push({
      id: q.id,
      year,
      number: q.number,
      code,
      code_note: o.codeNote ?? null,
      title: q.title,
      country: code ? code.split("-")[1] : null,
      category: "Penggalang (SMP)",
      topic: TOPIC[cls.t],
      difficulty: DIFF[cls.d],
      format,
      stem,
      options,
      key: key ?? (o.proposed ? { correct: o.proposed, proposed: true } : null),
      input_hint: o.inputHint ?? null,
      explanation,
      informatics,
      credit: q.credit,
      original: q.original,
      source: { ...SOURCES[year], pages: q.pages },
      status,
      review_note: [...problems, o.answerNote].filter(Boolean).join(" ") || null,
    });
    report.push(`${q.id} ${status === "published" ? "OK " : "REV"} ${format.padEnd(15)} ${String(key ? JSON.stringify(key.correct ?? key.accepted) : "-").padEnd(22)} ${q.title}`);
  }
}
fs.writeFileSync("data/bank.json", JSON.stringify({ sources: SOURCES, questions: bank }));
console.log(report.join("\n"));
const pub = bank.filter((q) => q.status === "published").length;
console.log(`\n${bank.length} soal: ${pub} terbit, ${bank.length - pub} perlu ditinjau. ${(fs.statSync("data/bank.json").size / 1024).toFixed(0)} KB`);
