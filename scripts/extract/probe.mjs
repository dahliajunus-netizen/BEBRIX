// Debug helper: node scripts/extract/probe.mjs <pdf> <from> <to> <outDir>
import fs from "node:fs";
import sharp from "sharp";
import { loadPdf, pageLines, renderPage } from "./pdf.mjs";
const [file, from, to, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const doc = await loadPdf(file);
console.log("pages", doc.numPages);
for (let p = +from; p <= Math.min(+to, doc.numPages); p++) {
  const page = await doc.getPage(p);
  const lines = await pageLines(page);
  console.log(`--- page ${p}`);
  for (const l of lines) console.log(`${Math.round(l.x0)},${Math.round(l.y0)} h${Math.round(l.h)} | ${l.text}`);
  const r = await renderPage(page);
  await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } }).resize({ width: 700 }).jpeg({ quality: 70 }).toFile(`${out}/p${p}.jpg`);
}
