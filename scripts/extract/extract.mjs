// Extracts Bebras Indonesia questions (Penggalang/SMP) from the source PDF books.
//
//   node scripts/extract/extract.mjs <pdf> <year> [--debug]
//
// Output: data/extracted/<year>.json and figure images in public/soal/<year>/.
// Every question is emitted as a draft. Nothing is published from here: the
// answer key is only trusted after scripts/extract/build-seed.mjs merges the
// manually verified overrides in data/overrides.json.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { loadPdf, pageLines, renderPage } from "./pdf.mjs";
import { findBands } from "./bands.mjs";

const [file, yearArg] = process.argv.slice(2);
const year = Number(yearArg);
const root = process.cwd();
const imgDir = path.join(root, "public", "soal", String(year));
fs.rmSync(imgDir, { recursive: true, force: true });
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(path.join(root, "data", "extracted"), { recursive: true });

const CODE = /(?:I-)?(20\d\d)-([A-Z]{2})-(\d\d[a-z]?)/;
const FOOTER = /^(Tantangan Bebras Indonesia 20\d\d|Halaman \d+ dari \d+|Bebras Indonesia\s*[–-]\s*Kelompok)/i;
const M = {
  challenge: /^(Tantangan|Pertanyaan)\s*:?/i,
  options: /^(?:Pili?han jawaban\s*:?\s*$|Pilih salah satu\s*:)/i,
  answer: /^Jawaban(\s+yang\s+(paling\s+)?(tepat|benar|benasr))?(\s+adalah)?\s*:?/,
  explanation: /^Penjelasan\s*:?/i,
  info: /^(Ini Informatika\s*!?|Aspek Informatika|Kata Penting dan Istilah|Kata Kunci\b.*)$/i,
  end: /^(Authorship|Author|License|Lisensi|Kontributor)\b/i,
};
const BULLET = /^[●•▪‣o]\s+/;

const clean = (s) =>
  s
    .replace(/[●▪]/g, "•")
    .replace(/ /g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

function mode(values, round = 2) {
  const c = new Map();
  for (const v of values) {
    const k = Math.round(v / round) * round;
    c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

const doc = await loadPdf(file);
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const lines = await pageLines(page);
  pages.push({ p, page, lines });
}

// --- 1. Split the book into questions: a question starts on a page whose top carries a task code.
const starts = [];
for (const pg of pages) {
  const head = pg.lines.filter((l) => l.y0 < 240);
  const codeLine = head.find((l) => CODE.test(l.text) && !/Kode Soal\s*:/.test(l.text.replace(/^.*?(Kode Soal)/, "$1")) );
  const isList = pg.lines.filter((l) => CODE.test(l.text)).length > 2;
  if (codeLine && !isList) starts.push(pg.p);
}

const questions = [];
for (let i = 0; i < starts.length; i++) {
  const from = starts[i];
  const to = (starts[i + 1] ?? doc.numPages + 1) - 1;
  questions.push(await extractQuestion(pages.slice(from - 1, to), i + 1));
}

fs.writeFileSync(path.join(root, "data", "extracted", `${year}.json`), JSON.stringify(questions, null, 1));
for (const q of questions) {
  const opts = q.options.map((o) => `${o.label}${o.text ? "=" + o.text.slice(0, 28) : o.image ? "=[img]" : ""}`).join(" | ");
  console.log(`\n#${q.id} ${q.code}«${q.title}» pages ${q.pages.join(",")} figs:${q.figureCount} type:${q.format}`);
  console.log(`  opts: ${opts || "(none)"}`);
  console.log(`  key: ${q.answer ?? "??"}   ans-text: ${q.answerText.slice(0, 150)}`);
  if (q.flags.length) console.log(`  FLAGS: ${q.flags.join("; ")}`);
}
console.log(`\n${year}: ${questions.length} questions`);

// ---------------------------------------------------------------------------------------------

async function extractQuestion(qPages, number) {
  const first = qPages[0];
  const head = first.lines.filter((l) => l.y0 < 240);
  const bodyH = mode(first.lines.filter((l) => l.y0 > 240).map((l) => l.h), 1) || 22;
  const codeLine = head.find((l) => CODE.test(l.text));
  const m = codeLine.text.match(CODE);
  const code = `${m[1]}-${m[2]}-${m[3]}`;
  const id = `${year}-${String(number).padStart(2, "0")}`;
  const titleLines = head.filter((l) => l.h >= bodyH * 1.2 && !FOOTER.test(l.text));
  let title = clean(titleLines.map((l) => l.text).join(" "))
    .replace(/\s*PENGGALANG.*$/i, "")
    .replace(/\s*Sumber\s*:.*$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/Bebras Challenge 20\d\d/gi, "")
    .replace(/Sumber\s*:/gi, "")
    .replace(/(?:I-)?20\d\d-[A-Z]{2}-\d\d\w*/g, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/- (?=[a-z])/g, "-")
    .trim();
  const headerBottom = Math.max(...head.filter((l) => l.h >= bodyH * 1.2 || CODE.test(l.text) || /^\(SMP\)|^Sumber|^Bebras Challenge|^Negara/.test(l.text)).map((l) => l.y1), 0);

  // Collect body lines over all pages with section tracking.
  const margin = mode(qPages.flatMap((pg) => pg.lines.filter((l) => !FOOTER.test(l.text)).map((l) => l.x0)), 2);
  const blocks = { stem: [], options: [], explanation: [], info: [], credit: [] };
  let section = "stem";
  const optionList = [];
  let letterRow = null;
  const figures = [];
  let figureCount = 0;
  const flags = [];
  const original = [];
  let stemOpen = true;

  for (const pg of qPages) {
    const isFirst = pg === first;
    const footer = pg.lines.filter((l) => FOOTER.test(l.text));
    const topLimit = isFirst
      ? headerBottom + 14
      : Math.max(0, ...footer.filter((l) => l.y0 < 140).map((l) => l.y1)) + 8 || 60;
    const bottomFooter = footer.filter((l) => l.y0 > 400).map((l) => l.y0);
    const pageH = pg.lines[0]?.pageH ?? 1600;
    const bottomLimit = (bottomFooter.length ? Math.min(...bottomFooter) : pageH - 60) - 6;
    const lines = pg.lines.filter((l) => !FOOTER.test(l.text) && l.y0 >= topLimit - 4 && l.y1 <= bottomLimit + 8);

    // Classify paragraph lines (text flow) vs. figure labels.
    let prev = null;
    for (const l of lines) {
      const t = clean(l.text);
      const marker = Object.values(M).some((re) => re.test(t));
      const bodyFont = Math.abs(l.h - bodyH) <= bodyH * 0.2;
      const nearMargin = l.x0 >= margin - 8 && l.x0 <= margin + 90;
      const adjacent = prev && prev.para && l.y0 - prev.y1 < bodyH * 0.9;
      l.para = marker || (bodyFont && nearMargin && (t.length >= 25 || adjacent || BULLET.test(t) || /^[A-Ea-e][.)]\s+\S/.test(t)));
      l.t = t;
      prev = l;
    }

    const render = await renderPage(pg.page);
    const bands = inlineBands(findBands(render, lines.filter((l) => l.para), topLimit, bottomLimit), lines, bodyH);

    // Merge lines and bands into reading order.
    const flow = [
      ...lines.map((l) => ({ kind: "line", y: l.y0, l })),
      ...bands.map((b) => ({ kind: "band", y: b.y0, b })),
    ].sort((a, b) => a.y - b.y);

    const inBand = (l) =>
      bands.some((b) => {
        const cy = (l.y0 + l.y1) / 2;
        const cx = (l.x0 + l.x1) / 2;
        return cy >= b.y0 && cy <= b.y1 && cx >= b.x0 - 4 && cx <= b.x1 + 4;
      });

    let stemEndY = null;
    for (const f of flow) {
      if (f.kind === "band") {
        const name = `${id}-${++figureCount}.webp`;
        const b = f.b;
        const meta = await cropTo(render, b, path.join(imgDir, name));
        const fig = { type: "img", src: `/soal/${year}/${name}`, w: meta.w, h: meta.h, y0: b.y0, y1: b.y1 };
        blocks[section === "credit" ? "info" : section].push(fig);
        figures.push({ section, fig });
        continue;
      }
      const l = f.l;
      const t = l.t;
      // Section switches.
      if (M.end.test(t)) section = "credit";
      else if (M.info.test(t)) section = "info";
      else if (section !== "credit" && section !== "info" && M.explanation.test(t)) section = "explanation";
      else if ((section === "stem" || section === "options") && M.answer.test(t) && !/^Jawaban\s*\(?[A-E]\)?\s+(salah|benar)/i.test(t)) section = "explanation";
      else if (section === "stem" && M.options.test(t)) {
        section = "options";
        // "Pilih salah satu: 0,1,2,3 atau 4 ?" lists the choices inline.
        const inline = t.replace(M.options, "").replace(/\?\s*$/, "").trim();
        if (inline) {
          const tokens = inline.split(/\s*,\s*|\s+atau\s+/).map((x) => x.trim()).filter(Boolean);
          const letters = tokens.every((x) => /^[A-H]$/.test(x));
          tokens.forEach((tok, i) => optionList.push({ label: null, raw: letters ? tok : null, text: letters ? "" : tok, y0: l.y0, y1: l.y1 }));
        }
        continue;
      }
      if (section === "explanation" && stemOpen) {
        stemEndY = l.y0 - 6;
        stemOpen = false;
      }
      if (section === "options" || section === "stem") {
        if (/^([A-F])(\s+[A-F]){1,5}$/.test(t)) letterRow = t.split(/\s+/);
      }
      if (section === "options") {
        const parts = t.split(/\s+(?=[A-Ha-h][.)]\s)/);
        const oms = parts.map((p) => p.match(/^(?:([A-Ha-h])\s*[.)]|[oOΟ○]\b|•)\s*(.*)$/));
        if (oms.every(Boolean)) {
          for (const om of oms) optionList.push({ label: null, raw: om[1]?.toUpperCase() ?? null, text: om[2].trim(), y0: l.y0, y1: l.y1 });
          continue;
        }
        if (optionList.length && l.para && !inBand(l)) {
          optionList[optionList.length - 1].text += " " + t;
          continue;
        }
      }
      if (inBand(l)) continue; // text that belongs to a figure (label, table cell)
      if (!l.para) {
        // Loose short text outside any figure: keep it, it is usually a caption or a formula.
        if (!t) continue;
      }
      blocks[section].push({ type: "line", text: t, x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1, pageW: l.pageW, bullet: BULLET.test(t), page: pg.p });
    }

    // Original (untouched) crop of the question part of this page, as a fidelity fallback.
    if (isFirst || stemOpen || stemEndY !== null) {
      const y0 = isFirst ? Math.max(0, headerBottom - bodyH * 4) : topLimit;
      const y1 = stemEndY ?? bottomLimit;
      if (y1 - y0 > 40 && (isFirst || original.length)) {
        const name = `${id}-asli-${original.length + 1}.webp`;
        const meta = await cropTo(render, { x0: margin - 30, x1: render.width - (margin - 30), y0: isFirst ? topLimit : y0, y1 }, path.join(imgDir, name), 78);
        original.push({ src: `/soal/${year}/${name}`, w: meta.w, h: meta.h });
      }
      if (stemEndY !== null) stemEndY = null;
    }
  }

  // --- Options ---
  // Some tasks list their choices right after the question without a "Pilihan Jawaban" heading.
  if (!optionList.length) {
    const OPT = /^(?:([A-Ha-h])\s*[.)]|[oOΟ○])\s+(.+)$/;
    const tail = [];
    for (let i = blocks.stem.length - 1; i >= 0; i--) {
      const b = blocks.stem[i];
      if (b.type === "img") continue; // a picture may float beside the list
      if (OPT.test(b.text)) tail.unshift(b);
      else break;
    }
    if (tail.length >= 2) {
      blocks.stem = blocks.stem.filter((b) => !tail.includes(b));
      for (const b of tail) {
        const om = b.text.match(OPT);
        optionList.push({ raw: om[1]?.toUpperCase() ?? null, text: om[2], y0: b.y0, y1: b.y1 });
      }
    }
  }
  let options = optionList.map((o, i) => ({ label: o.raw ?? "ABCDEFGH"[i], text: clean(o.text), y0: o.y0, y1: o.y1 }));
  const optFigs = blocks.options.filter((b) => b.type === "img");
  if (options.length && options.every((o) => !o.text) && optFigs.length === options.length) {
    options.forEach((o, i) => (o.image = { src: optFigs[i].src, w: optFigs[i].w, h: optFigs[i].h }));
    blocks.options = blocks.options.filter((b) => b.type !== "img");
  } else if (options.length && options.some((o) => !o.text)) {
    // Picture options next to their labels: attach by vertical overlap.
    for (const o of options) {
      if (o.text) continue;
      const fig = optFigs.find((f) => f.y0 <= o.y1 + 30 && f.y1 >= o.y0 - 30 && !f.used);
      if (fig) {
        fig.used = true;
        o.image = { src: fig.src, w: fig.w, h: fig.h };
      }
    }
    if (options.every((o) => o.text || o.image)) blocks.options = blocks.options.filter((b) => !(b.type === "img" && b.used));
    else options.forEach((o) => delete o.image);
  }
  if (!options.length && letterRow) options = letterRow.map((l) => ({ label: l, text: "" }));
  options = options.map(({ label, text, image }) => ({ label, text, ...(image ? { image } : {}) }));
  const labels = options.map((o) => o.label);
  if (new Set(labels).size !== labels.length) flags.push("label opsi ganda");

  // Remaining option-area figures and text stay with the stem so nothing is lost.
  const stemBlocks = toBlocks([...blocks.stem, ...blocks.options]);
  const explanationBlocks = toBlocks(blocks.explanation);
  const infoBlocks = toBlocks(blocks.info.filter((b) => !(b.type === "line" && M.info.test(b.text))));
  const credit = blocks.credit.filter((b) => b.type === "line").map((b) => b.text).join("\n");

  // --- Answer key (heuristic, always re-verified manually) ---
  const answerText = blocks.explanation.filter((b) => b.type === "line").map((b) => b.text).join(" ").replace(/\s+/g, " ");
  let answer = null;
  const ANS = /^Jawaban(\s+yang\s+(paling\s+)?(tepat|benar|benasr))?(\s+(adalah|yaitu))?(\s+gelas)?\s*:?\s*/i;
  const lead = answerText.replace(ANS, "").replace(ANS, "").trim();
  const lm = lead.match(/^\(?([A-Ea-e])\)?(?=[\s.,):]|$)/);
  if (lm && labels.includes(lm[1].toUpperCase())) answer = lm[1].toUpperCase();
  else {
    const val = lead.split(/[\s.,;]/)[0];
    const hit = options.find((o) => o.text && (o.text === val || lead.startsWith(o.text)));
    if (hit) answer = hit.label;
    else if (!options.length && /^\d+$/.test(val)) answer = val;
  }
  const format = options.length ? "single_choice" : "short_answer";
  if (!answer) flags.push("kunci jawaban belum terbaca");
  if (!stemBlocks.length) flags.push("teks soal kosong");
  if (!explanationBlocks.length) flags.push("penjelasan kosong");

  return {
    id,
    number,
    code,
    year,
    title,
    country: m[2],
    pages: qPages.map((p) => p.p),
    format,
    stem: stemBlocks,
    options,
    answer,
    answerText,
    explanation: explanationBlocks,
    informatics: infoBlocks,
    credit,
    original,
    figureCount,
    flags,
  };
}

/** Turn positioned lines + figures into paragraphs, list items and images. */
function toBlocks(items) {
  const out = [];
  let para = null;
  let prev = null;
  const flush = () => {
    if (para) out.push(para);
    para = null;
  };
  for (const it of items) {
    if (it.type === "img") {
      flush();
      out.push({ type: "img", src: it.src, w: it.w, h: it.h });
      prev = null;
      continue;
    }
    const text = it.text.replace(BULLET, "").trim();
    if (!text || /^Deskripsi Soal$/i.test(text)) continue;
    const heading = /^(Tantangan|Pertanyaan|Jawaban|Penjelasan|Jawaban yang (tepat|benar)|Solusi \d+)\s*:?$/i.test(text);
    const gap = prev ? it.y0 - prev.y1 : 0;
    const samePage = prev && prev.page === it.page;
    const prevShort = prev && prev.x1 < prev.pageW - prev.x0 - 120 && !/[,a-z]$/.test(prev.text);
    const startsNew =
      !para || it.bullet || heading || para.type === "h" || (samePage && gap > (it.y1 - it.y0) * 0.75) || (para.type === "li" && it.x0 < para.x0 - 6) || prevShort;
    if (startsNew) {
      flush();
      para = heading ? { type: "h", text: text.replace(/\s*:$/, "") } : it.bullet ? { type: "li", text, x0: it.x0 + 30 } : { type: "p", text };
    } else {
      para.text += (para.text.endsWith("-") && /^[a-z]/.test(text) ? "" : " ") + text;
    }
    prev = it;
  }
  flush();
  return out.map(({ x0, ...b }) => b);
}

/**
 * Small pictures that sit inside a text line (icons, symbols) cannot be separated from
 * their sentence. Such paragraphs are kept as one picture of the original text instead.
 */
function inlineBands(bands, lines, bodyH) {
  const isMarker = (l) => Object.values(M).some((re) => re.test(l.t));
  const para = lines.filter((l) => l.para);
  const out = [];
  for (const b of bands) {
    // The part of an icon inside the line box is masked, so the band only shows what sticks
    // out above or below the line: test for touching, within the line's horizontal extent.
    const cx = (b.x0 + b.x1) / 2;
    const hit = para.filter((l) => b.y1 >= l.y0 - 14 && b.y0 <= l.y1 + 16 && cx >= l.x0 - 10 && cx <= l.x1 + 60 && !isMarker(l));
    if (!hit.length || b.y1 - b.y0 > bodyH * 2.7) {
      out.push(b);
      continue;
    }
    // Grow over the whole paragraph.
    let group = [...hit];
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of para) {
        if (group.includes(l) || isMarker(l)) continue;
        const top = Math.min(...group.map((g) => g.y0));
        const bot = Math.max(...group.map((g) => g.y1));
        const first = group.find((g) => g.y0 === top);
        if ((l.y0 >= bot - 2 && l.y0 - bot < bodyH * 0.6) || (l.y1 <= top + 2 && top - l.y1 < bodyH * 0.6 && !BULLET.test(first.t) && !/^[A-Fa-f][.)]s/.test(first.t))) {
          if (l.y0 >= bot - 2 && (BULLET.test(l.t) || /^[A-Fa-f][.)]s/.test(l.t))) continue;
          group.push(l);
          grew = true;
        }
      }
    }
    out.push({
      inline: true,
      x0: Math.max(0, Math.min(b.x0, ...group.map((l) => l.x0)) - 8),
      x1: Math.max(b.x1, ...group.map((l) => l.x1)) + 8,
      y0: Math.min(b.y0, ...group.map((l) => l.y0 - 5)),
      y1: Math.max(b.y1, ...group.map((l) => l.y1 + 7)),
    });
  }
  out.sort((a, b) => a.y0 - b.y0);
  const merged = [];
  for (const b of out) {
    const last = merged[merged.length - 1];
    if (last && last.inline && b.inline && b.y0 <= last.y1 + 4) {
      last.y1 = Math.max(last.y1, b.y1);
      last.x0 = Math.min(last.x0, b.x0);
      last.x1 = Math.max(last.x1, b.x1);
    } else merged.push({ ...b });
  }
  return merged;
}

async function cropTo(render, b, file, quality = 82) {
  const left = Math.max(0, Math.floor(b.x0));
  const top = Math.max(0, Math.floor(b.y0));
  const w = Math.min(render.width - left, Math.ceil(b.x1 - b.x0));
  const h = Math.min(render.height - top, Math.ceil(b.y1 - b.y0));
  await sharp(render.data, { raw: { width: render.width, height: render.height, channels: 4 } })
    .extract({ left, top, width: w, height: h })
    .webp({ quality })
    .toFile(file);
  return { w, h };
}
