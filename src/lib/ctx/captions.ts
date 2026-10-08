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

export function memoryCaption(f: Obj): string {
  const probes = f.probes as number;
  return probes
    ? `${f.caption as string}. Recalled ${f.recalled as number} of ${probes} probe${probes === 1 ? "" : "s"} so far; ${fmtInt(f.read as number)} memory tokens read.`
    : `${f.caption as string}.`;
}

/** The long-context chapter's step: question i of the run, with each strategy's running total. */
export function costCaption(
  run: Obj,
  i: number,
  fmt: (usd: number) => string,
): string {
  const s = run.strategies as Record<string, Obj>;
  const q = i + 1;
  return (
    `question ${q} of ${run.questions as number}: ` +
    `long prompt ${fmt(s.long!.cum[i] as number)}, ` +
    `cached ${fmt(s["long+cache"]!.cum[i] as number)}` +
    ((s["long+cache"]!.cached[i] as number) > 0
      ? ` (${fmtInt(s["long+cache"]!.cached[i] as number)} tokens read from the cache)`
      : " (this call writes the cache)") +
    `, top-${run.k as number} retrieval ${fmt(s.rag!.cum[i] as number)} so far`
  );
}

/**
 * The packing animation's caption after `step` of the packer's steps (step 0: before the first;
 * the last: the final set, placed).
 */
export function packingCaption(
  view: Obj,
  packer: string,
  placement: string,
  step: number,
): string {
  const pk = view.packers[packer] as Obj;
  const steps = pk.steps as Obj[];
  const cands = view.candidates as Obj[];
  const B = view.budget as number;
  if (step === steps.length) {
    const placed = view.placed[packer][placement] as Obj;
    const answerIn = (pk.chosen as number[]).some(
      (i) => cands[i]!.relevant as boolean,
    );
    return (
      `${packer} packs ${(pk.chosen as number[]).length} chunks, ${fmtInt(pk.tokens as number)} of ${fmtInt(B)} tokens, value ${(pk.value as number).toFixed(2)}; ` +
      (answerIn
        ? `placed ${placement}, the answer sits where p = ${(placed.p as number).toFixed(2)}`
        : "the answer is not in the window")
    );
  }
  if (step === 0)
    return `${packer}: ${cands.length} reranked candidates for a ${fmtInt(B)}-token budget; press play`;
  return steps[step - 1]!.caption as string;
}
