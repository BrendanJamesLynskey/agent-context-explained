/**
 * Every number the chapters quote comes from here: a path into what the engine computes for each
 * chapter (the same data the animations draw, src/lib/engine's runChapter), e.g.
 * "hybrid.evals.rerank.mean.recall@1" or "window.runs.truncate-1500.recalled". The MDX writes
 * <V of="…" fmt="…" />, so prose cannot drift from the tested engine (tests/unit/values.test.ts
 * checks every path the chapters use resolves).
 *
 * Server-side only: it reads the tokenizer and the data files from disk.
 */
import {
  CHAPTER_CONFIGS,
  runChapter,
  type Chapter,
  type Obj,
} from "@/lib/engine";
import { nodeCorpus, nodeFiles } from "@/lib/engine/node";
import { fmtInt, pct, trim } from "@/lib/format";

export type Fmt = "int" | "pct" | "num" | "f2" | "f3" | "raw";

let TREE: Obj | null = null;

export function tree(): Obj {
  if (TREE) return TREE;
  const c = nodeCorpus();
  const t: Obj = {};
  for (const ch of Object.keys(CHAPTER_CONFIGS) as Chapter[])
    t[ch] = runChapter(ch, c);
  const man = nodeFiles()["manifest.json"]!;
  let tokens = 0;
  for (const p of c.pieces) for (const x of p) tokens += x[2];
  t.corpus = {
    articles: c.articles.length,
    questions: c.questions.length,
    pool: man.corpus.question_pool,
    tokens,
    sentences: c.sentences().length,
    rerank_pairs: c.files["rerank.json"]!.pairs,
  };
  t.manifest = man;
  // chunks longer than the embedder's 256 word pieces (truncated when embedded), per chunking
  const files = nodeFiles();
  t.truncated = {};
  for (const name of CHAPTER_CONFIGS.chunking.all as string[])
    t.truncated[name] = files[`emb-${name}.json`]!.truncated;
  // derived: what the window task costs and recalls, per budget, relative to no limit
  t.derived = {};
  for (const b of CHAPTER_CONFIGS.window.budgets as number[]) {
    const un = t.window.runs[`unbounded-${b}`];
    for (const p of CHAPTER_CONFIGS.window.policies as string[]) {
      const r = t.window.runs[`${p}-${b}`];
      t.derived[`${p}-${b}`] = { spent_vs_unbounded: r.spent / un.spent };
    }
  }
  TREE = t;
  return t;
}

export function lookup(path: string): unknown {
  // keys may contain dots: at each level take the shortest run of segments that names a key
  const parts = path.split(".");
  let v: unknown = tree();
  let i = 0;
  while (i < parts.length) {
    if (v === null || typeof v !== "object")
      throw new Error(`no value at "${path}"`);
    let j = i + 1;
    while (j <= parts.length && !(parts.slice(i, j).join(".") in (v as Obj)))
      j++;
    if (j > parts.length) throw new Error(`no value at "${path}"`);
    v = (v as Obj)[parts.slice(i, j).join(".")];
    i = j;
  }
  if (v === undefined || v === null) throw new Error(`no value at "${path}"`);
  return v;
}

export function formatValue(v: unknown, fmt: Fmt): string {
  if (fmt === "raw") return String(v);
  const n = v as number;
  switch (fmt) {
    case "int":
      return fmtInt(n);
    case "pct":
      return pct(n);
    case "num":
      return trim(n);
    case "f2":
      return n.toFixed(2);
    case "f3":
      return n.toFixed(3);
  }
}
