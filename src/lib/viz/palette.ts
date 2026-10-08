/**
 * The family's visual language (explained_sites_visual_standard.md §3): Okabe and Ito's
 * colour-blind-safe palette, the same in light and dark mode. On the Context site:
 *
 * - one colour per kind of window content (system prompt, task, retrieved chunk, summary);
 * - one colour per retrieval stage (BM25, dense, RRF, weighted, reranked) and per article;
 * - "active" is a highlight, "done" is muted, and dropped or cut things use the warning hue plus a
 *   hatch pattern, never colour alone; a relevant chunk is also marked with a tick.
 *
 * Okabe, M. and Ito, K. (2008), "Color Universal Design (CUD): how to make figures and
 * presentations that are friendly to colorblind people", https://jfly.uni-koeln.de/color/
 */

export const OKABE_ITO = {
  black: "#000000",
  orange: "#E69F00",
  sky: "#56B4E9",
  green: "#009E73",
  yellow: "#F0E442",
  blue: "#0072B2",
  vermillion: "#D55E00",
  purple: "#CC79A7",
} as const;

/** What sits in the window, the same on every chapter. */
export const KIND_COLOUR: Record<string, string> = {
  system: OKABE_ITO.sky,
  task: OKABE_ITO.blue,
  read: OKABE_ITO.orange,
  summary: OKABE_ITO.green,
};
export const KIND_NAME: Record<string, string> = {
  system: "System prompt",
  task: "Task",
  read: "Retrieved chunk",
  summary: "Summary",
};

/** One colour per retrieval stage. */
export const STAGE_COLOUR: Record<string, string> = {
  bm25: OKABE_ITO.orange,
  dense: OKABE_ITO.blue,
  rrf: OKABE_ITO.purple,
  weighted: OKABE_ITO.sky,
  rerank: OKABE_ITO.green,
};
export const STAGE_NAME: Record<string, string> = {
  bm25: "BM25",
  dense: "Dense",
  rrf: "RRF",
  weighted: "Weighted",
  rerank: "Reranked",
};

/** One colour per article of the corpus (vermillion is kept for warnings). */
export const ARTICLE_COLOUR = [
  OKABE_ITO.orange,
  OKABE_ITO.sky,
  OKABE_ITO.green,
  OKABE_ITO.yellow,
  OKABE_ITO.blue,
  OKABE_ITO.purple,
];

/** One colour per chunker. */
export const CHUNKER_COLOUR: Record<string, string> = {
  "fixed-256": OKABE_ITO.orange,
  "recursive-256": OKABE_ITO.blue,
  "semantic-256": OKABE_ITO.green,
};

/** A relevant chunk (holds the answer) is green and ticked; a cut answer is the warning hue, hatched. */
export const RELEVANT = OKABE_ITO.green;

export const STATE_COLOUR = {
  active: OKABE_ITO.blue,
  stalled: OKABE_ITO.vermillion,
  ok: OKABE_ITO.green,
} as const;

/** Muted ("done", "idle") greys: Tailwind neutral-400 and neutral-600. */
export const MUTED = { light: "#a3a3a3", dark: "#525252" } as const;
