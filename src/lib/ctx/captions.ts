/**
 * The live caption under each animation. Most frames carry the engine's own caption (computed by
 * the Python reference and the TS port alike); these add the running totals the page shows and
 * build the steps and captions of the chunking animation. Pure functions of the frames, tested on
 * the reference's frames and the port's (tests/unit/frames.test.ts).
 */
import type { Obj } from "@/lib/engine";
import { fmtInt } from "@/lib/format";

export function windowCaption(f: Obj): string {
  const known = (f.known as number[]).length;
  return `${f.caption as string}. Window ${fmtInt(f.used as number)} of ${fmtInt(f.budget as number)} tokens; knows ${known} fact${known === 1 ? "" : "s"}; ${fmtInt(f.spent as number)} input tokens spent.`;
}

export function hybridCaption(f: Obj): string {
  return f.caption as string;
}

export type ChunkStep = { config: string; index: number };

/** The chunking animation's steps: each config's chunks in turn, one per step. */
export function chunkSteps(view: Obj): ChunkStep[] {
  const out: ChunkStep[] = [];
  for (const [config, chunks] of Object.entries(
    view.configs as Record<string, Obj[]>,
  ))
    for (let i = 0; i < chunks.length; i++) out.push({ config, index: i });
  return out;
}

/** Answers in the excerpt that no chunk of `config` holds whole (cut by a boundary). */
export function cutAnswers(view: Obj, config: string): number[] {
  const chunks = (view.configs as Record<string, Obj[]>)[config]!;
  return (view.answers as Obj[])
    .filter((a) => !chunks.some((c) => c.start <= a.start && a.end <= c.end))
    .map((a) => a.q as number);
}

export function chunkCaption(view: Obj, s: ChunkStep): string {
  const chunks = (view.configs as Record<string, Obj[]>)[s.config]!;
  const c = chunks[s.index]!;
  const inside = (view.answers as Obj[]).filter(
    (a) => c.start <= a.start && a.end <= c.end,
  ).length;
  const cut = (view.answers as Obj[]).filter(
    (a) =>
      a.start < c.end &&
      a.end > c.start &&
      !(c.start <= a.start && a.end <= c.end),
  ).length;
  return (
    `${s.config}: chunk ${s.index + 1} of ${chunks.length} here (${c.tokens} tokens)` +
    (inside ? `; holds ${inside} answer${inside === 1 ? "" : "s"} whole` : "") +
    (cut ? `; cuts through ${cut} answer${cut === 1 ? "" : "s"}` : "")
  );
}
