// Review helper: node scripts/extract/preview.mjs <outDir>
// Writes one downscaled image per question showing the untouched question part of the page.
import fs from "node:fs";
import sharp from "sharp";
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
for (const y of [2016, 2017, 2018, 2019, 2020]) {
  const qs = JSON.parse(fs.readFileSync(`data/extracted/${y}.json`, "utf8"));
  for (const q of qs) {
    let yy = 0;
    let w = 10;
    const comps = [];
    for (const o of q.original) {
      comps.push({ input: "public" + o.src, left: 0, top: yy });
      yy += o.h + 10;
      w = Math.max(w, o.w);
    }
    if (!comps.length) {
      console.log("no original crop", q.id);
      continue;
    }
    const full = await sharp({ create: { width: w, height: yy, channels: 3, background: "#f55" } }).composite(comps).png().toBuffer();
    await sharp(full).resize({ width: 600 }).jpeg({ quality: 55 }).toFile(`${out}/${q.id}.jpg`);
  }
}
