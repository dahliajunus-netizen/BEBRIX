/* eslint-disable @next/next/no-img-element */
import type { Block } from "@/lib/types";
import { assetUrl, cn } from "@/lib/utils";

/** Diagrams were captured at 2× from the source PDF: show them at half size, never upscaled. */
export function Figure({ src, w, h, alt, className }: { src: string; w: number; h: number; alt?: string; className?: string }) {
  return (
    <img
      src={assetUrl(src)}
      alt={alt ?? "Gambar soal"}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      className={cn("h-auto max-w-full rounded-lg", className)}
      style={{ width: Math.max(Math.round(w / 1.6), 40) }}
    />
  );
}

/** Renders extracted question content: paragraphs, headings, list items, diagrams and tables. */
export function Blocks({ blocks, className }: { blocks: Block[]; className?: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={`l${out.length}`} className="ml-5 list-disc space-y-1.5 marker:text-brand-500">
        {list.map((t, i) => <li key={i}>{t}</li>)}
      </ul>,
    );
    list = [];
  };
  blocks.forEach((b, i) => {
    if (b.type === "li") return void list.push(b.text);
    flush();
    if (b.type === "p") out.push(<p key={i}>{b.text}</p>);
    else if (b.type === "h") out.push(<p key={i} className="pt-1 text-sm font-bold uppercase tracking-wide text-navy-800">{b.text}</p>);
    else if (b.type === "img")
      out.push(
        <div key={i} className="overflow-x-auto rounded-xl border border-line bg-white p-2">
          <Figure {...b} />
        </div>,
      );
    else if (b.type === "table")
      out.push(
        <div key={i} className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    r === 0 ? <th key={c} className="border border-line bg-canvas px-3 py-1.5 text-left font-semibold">{cell}</th> : <td key={c} className="border border-line px-3 py-1.5">{cell}</td>,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
  });
  flush();
  return <div className={cn("space-y-3 text-[15px] leading-relaxed text-ink", className)}>{out}</div>;
}
