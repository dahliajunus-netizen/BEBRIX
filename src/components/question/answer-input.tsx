"use client";

import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { Figure } from "./blocks";
import { Input } from "@/components/ui";
import type { AnswerKey, Question, Response } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  question: Question;
  value: Response;
  onChange: (r: Response) => void;
  disabled?: boolean;
  /** When set, the correct answer is highlighted (after submission / in review). */
  reveal?: AnswerKey | null;
}

/** One input per question format. The value is validated on the server, never here. */
export function AnswerInput({ question, value, onChange, disabled, reveal }: Props) {
  switch (question.format) {
    case "single_choice":
    case "multiple_choice":
      return <Choices {...{ question, value, onChange, disabled, reveal }} />;
    case "short_answer":
      return <ShortAnswer {...{ question, value, onChange, disabled, reveal }} />;
    case "ordering":
      return <Ordering {...{ question, value, onChange, disabled, reveal }} />;
    case "grid_select":
      return <GridSelect {...{ question, value, onChange, disabled, reveal }} />;
  }
}

function Choices({ question, value, onChange, disabled, reveal }: Props) {
  const multi = question.format === "multiple_choice";
  const selected = multi ? (value.choices ?? []) : value.choice ? [value.choice] : [];
  const correct = reveal?.correct ?? [];
  const pictureOnly = question.question_options.every((o) => !o.text && !o.image);
  const toggle = (label: string) => {
    if (disabled) return;
    if (multi) onChange({ choices: selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label].sort() });
    else onChange({ choice: label });
  };
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-muted">
        {multi ? "Pilih semua jawaban yang benar" : "Pilih satu jawaban"}
        {pictureOnly && " — huruf pilihan mengacu pada gambar di atas"}
      </legend>
      <div className={cn("grid gap-2.5", pictureOnly ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-1")}>
        {question.question_options.map((o) => {
          const isSel = selected.includes(o.label);
          const isRight = reveal && correct.includes(o.label);
          const isWrong = reveal && isSel && !isRight;
          return (
            <button key={o.label} type="button" role={multi ? "checkbox" : "radio"} aria-checked={isSel} disabled={disabled} onClick={() => toggle(o.label)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 bg-surface px-3.5 py-3 text-left text-[15px] disabled:cursor-default",
                isRight ? "border-good bg-good-50" : isWrong ? "border-bad bg-bad-50" : isSel ? "border-brand-600 bg-brand-50" : "border-line",
                !disabled && !isSel && "hover:border-brand-500",
              )}>
              <span className={cn(
                "flex size-8 shrink-0 items-center justify-center text-sm font-bold",
                multi ? "rounded-lg" : "rounded-full",
                isRight ? "bg-good text-white" : isWrong ? "bg-bad text-white" : isSel ? "bg-brand-600 text-white" : "bg-canvas text-navy-800",
              )}>
                {isRight ? <Check className="size-4" /> : isWrong ? <X className="size-4" /> : o.label}
              </span>
              <span className="min-w-0 flex-1">
                {o.image && <span className="block overflow-x-auto"><Figure {...o.image} alt={`Pilihan ${o.label}`} /></span>}
                {o.text && <span className="block break-words">{o.text}</span>}
                {!o.text && !o.image && <span className="font-semibold text-navy-800">Pilihan {o.label}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ShortAnswer({ question, value, onChange, disabled, reveal }: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-muted" htmlFor={`a-${question.id}`}>Tulis jawabanmu</label>
      <Input id={`a-${question.id}`} value={value.text ?? ""} disabled={disabled} autoComplete="off" spellCheck={false} maxLength={80}
        onChange={(e) => onChange({ text: e.target.value })} placeholder="Ketik jawaban di sini" className="max-w-sm font-mono text-base" />
      {question.input_hint && <p className="mt-1.5 text-xs text-faint">{question.input_hint}</p>}
      {reveal?.accepted && (
        <p className="mt-2 text-sm text-ink">Jawaban yang benar: <strong className="font-mono text-good">{reveal.accepted[0]}</strong></p>
      )}
    </div>
  );
}

function Ordering({ question, value, onChange, disabled, reveal }: Props) {
  const labels = question.question_options.map((o) => o.label);
  const order = value.order?.length === labels.length ? value.order : labels;
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange({ order: next });
  };
  const byLabel = new Map(question.question_options.map((o) => [o.label, o]));
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted">Susun urutan yang benar: seret, atau gunakan tombol panah</p>
      <ol className="space-y-2">
        {order.map((label, i) => {
          const o = byLabel.get(label)!;
          const right = reveal?.correct && reveal.correct[i] === label;
          return (
            <li key={label} draggable={!disabled} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
              className={cn("flex items-center gap-2 rounded-xl border-2 bg-surface px-3 py-2.5", reveal ? (right ? "border-good bg-good-50" : "border-bad bg-bad-50") : "border-line", drag === i && "opacity-50")}>
              <GripVertical className="size-4 shrink-0 cursor-grab text-faint" aria-hidden />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-navy-800">{i + 1}</span>
              <span className="min-w-0 flex-1 text-[15px]">{o.image && <Figure {...o.image} />}{o.text}</span>
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label="Naikkan" className="rounded-lg p-1.5 text-muted hover:bg-canvas disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)} aria-label="Turunkan" className="rounded-lg p-1.5 text-muted hover:bg-canvas disabled:opacity-30"><ArrowDown className="size-4" /></button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function GridSelect({ question, value, onChange, disabled, reveal }: Props) {
  const rows = question.config.rows ?? 4;
  const cols = question.config.cols ?? 4;
  const selected = value.choices ?? [];
  const correct = reveal?.correct ?? [];
  const toggle = (id: string) => !disabled && onChange({ choices: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].sort() });
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted">Ketuk petak untuk menandainya</p>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const id = `${Math.floor(i / cols) + 1}-${(i % cols) + 1}`;
          const isSel = selected.includes(id);
          const isRight = reveal && correct.includes(id);
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => toggle(id)} aria-pressed={isSel} aria-label={`Baris ${id.split("-")[0]} kolom ${id.split("-")[1]}`}
              className={cn("size-10 rounded-lg border-2 sm:size-11", isRight ? (isSel ? "border-good bg-good" : "border-good bg-good-50") : reveal && isSel ? "border-bad bg-bad" : isSel ? "border-brand-600 bg-brand-600" : "border-line bg-surface hover:border-brand-500")} />
          );
        })}
      </div>
    </div>
  );
}
