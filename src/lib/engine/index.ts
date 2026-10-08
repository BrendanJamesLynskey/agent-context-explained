/**
 * The vendored Agent_Loop_Sim engine (src/lib/engine/vendor, pinned in VENDORED.json) and what
 * each chapter animates (src/data/chapter_configs.json). Everything is recomputed from the
 * engine's shipped data (public/context: the corpus, the int8 embeddings, the recorded reranker
 * scores): chunk boundaries, BM25, cosines, fusion, every metric and every frame. Nothing here
 * runs a language model or an embedding model.
 */
import CONFIGS from "@/data/chapter_configs.json";

import { context as C, type Obj, type Tokenizer } from "./vendor/index";

export * from "./vendor/index";
export const ctx = C;

export type Chapter = keyof typeof CONFIGS;
export const CHAPTER_CONFIGS = CONFIGS as unknown as Record<Chapter, Obj>;

/** Where the browser fetches the tokenizer's merges and the engine's data files. */
export const MERGES_URL = "/tokenizer/qwen2.5-merges.txt";
export const DATA_URL = "/context/";

/** The data files a chapter needs (fetched lazily, in the worker). */
export function filesFor(chapter: Chapter): string[] {
  return CHAPTER_CONFIGS[chapter].files as string[];
}

/** One corpus per process (worker or server); data files are added as chapters need them. */
export function makeCorpus(
  files: Record<string, Obj>,
  tok: Tokenizer,
): C.Corpus {
  return new C.Corpus(files["corpus.json"]!, files, tok);
}

const retrievers = new WeakMap<C.Corpus, Map<string, C.Retriever>>();

export function retriever(corpus: C.Corpus, config: string): C.Retriever {
  let m = retrievers.get(corpus);
  if (!m) {
    m = new Map();
    retrievers.set(corpus, m);
  }
  let r = m.get(config);
  if (!r) {
    r = new C.Retriever(corpus, config);
    m.set(config, r);
  }
  return r;
}

/** A question as the widgets show it. */
export function questionInfo(corpus: C.Corpus, qi: number): Obj {
  const q = corpus.questions[qi]!;
  return {
    q: qi,
    question: q.question,
    answer: q.answer,
    article: q.article,
    title: corpus.articles[q.article]!.title,
  };
}

/** A chunk as the widgets show it: where it is and its text. */
export function chunkInfo(corpus: C.Corpus, r: C.Retriever, c: number): Obj {
  const ch = r.chunks[c]!;
  return {
    chunk: c,
    article: ch.article,
    title: corpus.articles[ch.article]!.title,
    tokens: ch.tokens,
    text: corpus.chunkText(ch),
  };
}

function textsOf(
  corpus: C.Corpus,
  r: C.Retriever,
  ids: Iterable<number>,
): Record<number, Obj> {
  const out: Record<number, Obj> = {};
  for (const c of ids) out[c] = chunkInfo(corpus, r, c);
  return out;
}

function evalSummary(e: Obj): Obj {
  return {
    config: e.config,
    method: e.method,
    params: e.params,
    lost: e.lost,
    mean: e.mean,
  };
}

/** BM25 for one query and (k1, b): the view plus the chunks it names. */
export function bm25Query(
  corpus: C.Corpus,
  query: string,
  k1: number,
  b: number,
): Obj {
  const r = retriever(corpus, C.DEFAULT);
  const v = C.bm25View(r, query, k1, b);
  const ids = new Set<number>();
  for (const row of v.top as Obj[]) ids.add(row.chunk as number);
  for (const f of v.frames as Obj[])
    for (const t of f.top as Obj[]) ids.add(t.chunk as number);
  return { ...v, chunks: textsOf(corpus, r, ids) };
}

export type ChapterData = Obj;

/** Everything one chapter animates. */
export function runChapter(chapter: Chapter, corpus: C.Corpus): ChapterData {
  const cfg = CHAPTER_CONFIGS[chapter];
  const r = retriever(corpus, C.DEFAULT);
  if (chapter === "window") {
    const task = C.taskQuestions(r, cfg.task as number);
    const runs: Obj = {};
    for (const b of cfg.budgets as number[])
      for (const p of cfg.policies as string[])
        runs[`${p}-${b}`] = C.windowRun(r, task, b, p);
    return { task: task.map((qi) => questionInfo(corpus, qi)), runs };
  }
  if (chapter === "lexical") {
    const qs = (cfg.queries as number[]).map(
      (qi) => corpus.questions[qi]!.question as string,
    );
    const views: Obj = {};
    for (const q of qs.concat(cfg.free as string[]))
      views[q] = bm25Query(corpus, q, C.K1, C.B);
    const evals = (cfg.evals as number[][]).map(([k1, b]) =>
      evalSummary(C.evaluate(r, "bm25", { k1, b })),
    );
    return {
      questions: (cfg.queries as number[]).map((qi) =>
        questionInfo(corpus, qi),
      ),
      relevant: Object.fromEntries(
        (cfg.queries as number[]).map((qi) => [
          qi,
          C.relevant(r.chunks, corpus.questions[qi]!),
        ]),
      ),
      free: cfg.free,
      views,
      n: r.bm25.n,
      avgdl: r.bm25.avgdl,
      terms: r.bm25.df.size,
      evals,
    };
  }
  if (chapter === "dense") {
    const path = cfg.path as number[];
    const frames: Obj = {};
    const evals: Obj = {};
    const ids = new Set<number>();
    for (const p of cfg.precisions as string[]) {
      frames[p] = C.denseFrames(r, path, p, cfg.k as number);
      for (const f of frames[p] as Obj[])
        for (const nb of f.neighbours as Obj[]) ids.add(nb.chunk as number);
      evals[p] = evalSummary(C.evaluate(r, "dense", { precision: p }));
    }
    const pca = corpus.files["pca.json"]!;
    const man = corpus.files["manifest.json"]!;
    return {
      questions: path.map((qi) => questionInfo(corpus, qi)),
      frames,
      evals,
      float32: man.offline_float32[C.DEFAULT],
      bytes: Object.fromEntries(
        (cfg.precisions as string[]).map((p) => [p, C.nbytes(384, p)]),
      ),
      pca: {
        explained: pca.explained,
        chunks: pca.chunks,
        questions: path.map((qi) => (pca.questions as number[][])[qi]),
        articles: r.chunks.map((c) => c.article),
      },
      chunks: textsOf(corpus, r, ids),
      model: man.embedder.repo,
    };
  }
  if (chapter === "hybrid") {
    const n = cfg.n as number;
    const hy: Obj = {};
    const ids = new Set<number>();
    for (const qi of cfg.questions as number[]) {
      hy[qi] = C.hybridFrames(r, qi, C.RRF_K, 50, 10, n);
      for (const k of ["bm25", "dense", "fused", "reranked"])
        for (const c of hy[qi][k] as number[]) ids.add(c);
    }
    const stages: [string, string, Obj][] = [
      ["bm25", "bm25", {}],
      ["dense", "dense", {}],
      ["rrf", "rrf", {}],
      ["weighted", "weighted", { alpha: 0.5 }],
      ["rerank", "rerank", { n }],
    ];
    const evals: Obj = {};
    for (const [key, m, p] of stages)
      evals[key] = evalSummary(C.evaluate(r, m, p));
    return {
      questions: (cfg.questions as number[]).map((qi) =>
        questionInfo(corpus, qi),
      ),
      hybrid: hy,
      evals,
      chunks: textsOf(corpus, r, ids),
      model: corpus.files["rerank.json"]!.model,
      pool: corpus.files["rerank.json"]!.pool,
    };
  }
  // chunking
  const all: Record<string, C.Retriever> = {};
  for (const name of cfg.all as string[]) all[name] = retriever(corpus, name);
  const shown: Record<string, C.Retriever> = {};
  for (const name of cfg.configs as string[]) shown[name] = all[name]!;
  const [s, e] = cfg.excerpt as [number, number];
  const view = C.chunkView(shown, cfg.article as number, s, e);
  const table: Obj = {};
  for (const [name, rr] of Object.entries(all)) {
    let tok = 0;
    for (const c of rr.chunks) tok += c.tokens;
    table[name] = {
      chunks: rr.chunks.length,
      mean_tokens: tok / rr.chunks.length,
      bm25: evalSummary(C.evaluate(rr, "bm25")),
      dense: evalSummary(C.evaluate(rr, "dense")),
      rrf: evalSummary(C.evaluate(rr, "rrf")),
    };
  }
  return {
    view,
    text: (corpus.articles[cfg.article as number]!.text as string).slice(s, e),
    title: corpus.articles[cfg.article as number]!.title,
    table,
  };
}
