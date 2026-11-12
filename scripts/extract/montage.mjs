// Review helper: node scripts/extract/montage.mjs <year> <outDir> <code...>
// Stacks the extracted figures of a question into one image for visual checking.
import fs from "node:fs";
import sharp from "sharp";
const [year, out, ...codes] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const dir = `public/soal/${year}`;
for (const code of codes) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(code + "-") && !f.includes("asli"))
    .sort((a, b) => parseInt(a.split("-").pop()) - parseInt(b.split("-").pop()));
  let y = 0;
  let w = 100;
  const comps = [];
  for (const f of files) {
    const m = await sharp(`${dir}/${f}`).metadata();
    comps.push({ input: `${dir}/${f}`, left: 0, top: y });
    y += m.height + 30;
    w = Math.max(w, m.width);
  }
  if (!comps.length) continue;
  const full = await sharp({ create: { width: w, height: y, channels: 3, background: "#ffe98a" } }).composite(comps).png().toBuffer();
  await sharp(full)
    .resize({ width: Math.min(w, 760) })
    .jpeg({ quality: 68 })
    .toFile(`${out}/${code}.jpg`);
  console.log(code, files.length);
}
