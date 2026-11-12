// Shared PDF helpers: load a document, read positioned text lines, render pages.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));

export const SCALE = 2;

export async function loadPdf(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  return pdfjs.getDocument({
    data,
    standardFontDataUrl: path.join(pdfjsRoot, "standard_fonts").split(path.sep).join("/") + "/",
    cMapUrl: path.join(pdfjsRoot, "cmaps").split(path.sep).join("/") + "/",
    cMapPacked: true,
    verbosity: 0,
  }).promise;
}

/** Text lines of a page in viewport pixels (at SCALE), top to bottom. */
export async function pageLines(page) {
  const vp = page.getViewport({ scale: SCALE });
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const [x, yBase] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const h = Math.abs(it.transform[3] || it.height) * SCALE;
    items.push({ str: it.str, x, y: yBase - h, w: it.width * SCALE, h });
  }
  items.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const lines = [];
  for (const it of items) {
    const mid = it.y + it.h / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.mid - mid) < Math.max(last.h, it.h) * 0.45) {
      last.items.push(it);
    } else {
      lines.push({ mid, h: it.h, items: [it] });
    }
  }
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = null;
    for (const it of l.items) {
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > it.h * 1.2) text += "   ";
        else if (gap > it.h * 0.12 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      }
      text += it.str;
      prevEnd = it.x + it.w;
    }
    const x0 = Math.min(...l.items.map((i) => i.x));
    const x1 = Math.max(...l.items.map((i) => i.x + i.w));
    const y0 = Math.min(...l.items.map((i) => i.y));
    const y1 = Math.max(...l.items.map((i) => i.y + i.h));
    const h = Math.max(...l.items.map((i) => i.h));
    // Horizontal runs of text; a wide gap between runs may hold an inline picture.
    const spans = [];
    for (const it of l.items) {
      const last = spans[spans.length - 1];
      if (last && it.x - last[1] < h * 1.1) last[1] = Math.max(last[1], it.x + it.w);
      else spans.push([it.x, it.x + it.w]);
    }
    return { text: text.replace(/\s+$/g, ""), x0, x1, y0, y1, h, spans, pageW: vp.width, pageH: vp.height };
  });
}

/** Render a page to an RGBA buffer at SCALE. */
export async function renderPage(page) {
  const vp = page.getViewport({ scale: SCALE });
  const { createCanvas } = require("@napi-rs/canvas");
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: Buffer.from(img.data.buffer) };
}
