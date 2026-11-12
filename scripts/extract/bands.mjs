// Figure detection: horizontal bands of drawing ink outside paragraph text.

const WHITE = 232;
const quant = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
const near = (k, b) =>
  Math.abs((k >> 10) - (b >> 10)) <= 1 && Math.abs(((k >> 5) & 31) - ((b >> 5) & 31)) <= 1 && Math.abs((k & 31) - (b & 31)) <= 1;

/**
 * Flat fills that span most of the page width for many rows are panel backgrounds
 * (for example the pink answer box of the 2016 book), not drawings.
 */
function panelColours(render, top, bottom) {
  const { width, data } = render;
  const rowsPerColour = new Map();
  const hist = new Map();
  for (let y = top; y < bottom; y++) {
    hist.clear();
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE) continue;
      const k = quant(data[i], data[i + 1], data[i + 2]);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    for (const [k, n] of hist) if (n > width * 0.3) rowsPerColour.set(k, (rowsPerColour.get(k) || 0) + 1);
  }
  return [...rowsPerColour.entries()].filter(([, rows]) => rows >= 40).map(([k]) => k);
}

export function findBands(render, paraLines, topLimit, bottomLimit) {
  const { width, height, data } = render;
  const top = Math.max(0, Math.floor(topLimit));
  const bottom = Math.min(height, Math.floor(bottomLimit));
  const masked = new Uint8Array(width * height); // 1 = paragraph text, ignore
  for (const l of paraLines) {
    const y0 = Math.max(0, Math.floor(l.y0 - 5));
    const y1 = Math.min(height, Math.ceil(l.y1 + 7));
    for (const [sx0, sx1] of l.spans) {
      const x0 = Math.max(0, Math.floor(sx0 - 6));
      const x1 = Math.min(width, Math.ceil(sx1 + 6));
      for (let y = y0; y < y1; y++) masked.fill(1, y * width + x0, y * width + x1);
    }
  }
  const panels = panelColours(render, top, bottom);
  const isPanel = (i) => {
    if (!panels.length) return false;
    const k = quant(data[i], data[i + 1], data[i + 2]);
    for (const b of panels) if (near(k, b)) return true;
    return false;
  };
  const ink = (x, y) => {
    if (masked[y * width + x]) return false;
    const i = (y * width + x) * 4;
    if (data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE) return false;
    return !isPanel(i);
  };

  const rowInk = [];
  const rowInPanel = [];
  for (let y = top; y < bottom; y++) {
    let n = 0;
    let p = 0;
    for (let x = 0; x < width; x++) {
      if (ink(x, y)) n++;
      else if (panels.length && x % 4 === 0 && isPanel((y * width + x) * 4)) p++;
    }
    rowInk.push(n);
    rowInPanel.push(p > 20);
  }
  const bands = [];
  let start = -1;
  let gap = 0;
  const GAP = 18;
  for (let i = 0; i <= rowInk.length; i++) {
    // Inside a panel the two vertical frame lines are always present: ask for more ink.
    const has = i < rowInk.length && rowInk[i] >= (rowInPanel[i] ? 16 : 3);
    if (has) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap > GAP || i === rowInk.length) {
        bands.push({ y0: top + start, y1: top + i - gap + 1 });
        start = -1;
        gap = 0;
      }
    }
  }
  const out = [];
  for (const b of bands) {
    if (b.y1 - b.y0 < 18) continue; // rules, underlines, stray specks
    const cols = new Uint32Array(width);
    let total = 0;
    for (let y = b.y0; y < b.y1; y++)
      for (let x = 0; x < width; x++)
        if (ink(x, y)) {
          cols[x]++;
          total++;
        }
    // Ignore thin full-height columns (panel frame) when measuring the horizontal extent.
    const inPanel = rowInPanel.slice(b.y0 - top, b.y1 - top).some(Boolean);
    let x0 = width;
    let x1 = 0;
    for (let x = 0; x < width; x++) {
      if (!cols[x]) continue;
      if (inPanel && cols[x] >= (b.y1 - b.y0) * 0.9 && !(cols[x + 6] && cols[x - 6])) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
    if (total < 150 || x1 - x0 < 18) continue;
    out.push({ y0: Math.max(0, b.y0 - 6), y1: Math.min(height, b.y1 + 6), x0: Math.max(0, x0 - 8), x1: Math.min(width, x1 + 8) });
  }
  return out;
}
