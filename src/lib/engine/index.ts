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

/** A run without its frames (for the numbers a chapter quotes but does not animate). */
function summaryOf(w: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(w)) if (k !== "frames") out[k] = v;
  return out;
}

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
    for (const b of cfg.budgets as number[])
      for (const p of cfg.lossy as string[])
        runs[`lossy-${p}-${b}`] = C.windowRun(r, task, b, p, "lossy");
    return { task: task.map((qi) => questionInfo(corpus, qi)), runs };
  }
  if (chapter === "packing") {
    const views: Obj = {};
    const ids = new Set<number>();
    for (const qi of cfg.questions as number[])
      for (const b of cfg.budgets as number[]) {
        const v = C.packingView(r, qi, b);
        // every packer's final set in every placement (the view has the optimal set's)
        const cands = v.candidates as C.Cand[];
        const placed: Obj = {};
        for (const p of C.PACKERS) {
          placed[p] = {};
          const ch = v.packers[p].chosen as number[];
          for (const pl of C.PLACEMENTS) {
            const order = C.place(cands, ch, pl);
            placed[p][pl] = {
              order,
              positions: order.length ? C.positions(cands, order) : [],
              p: order.length ? C.answerP(cands, order) : 0,
            };
          }
        }
        views[`${qi}-${b}`] = { ...v, placed };
        for (const c of v.candidates as Obj[]) ids.add(c.chunk as number);
      }
    return {
      questions: (cfg.questions as number[]).map((qi) =>
        questionInfo(corpus, qi),
      ),
      views,
      eval: C.packingEval(r, cfg.eval_budgets as number[]),
      curve: C.positionCurve(),
      position: C.POSITION,
      chunks: Object.fromEntries(
        [...ids].map((c) => [
          c,
          {
            chunk: c,
            title: corpus.articles[r.chunks[c]!.article]!.title,
            tokens: r.chunks[c]!.tokens,
          },
        ]),
      ),
    };
  }
  if (chapter === "compaction") {
    const task = C.taskQuestions(r, cfg.task as number);
    const runs: Obj = {};
    const baselines: Obj = {};
    const studies: Obj = {};
    const seeds = Array.from({ length: cfg.seeds as number }, (_, i) => i + 1);
    for (const b of cfg.budgets as number[]) {
      for (const p of cfg.baselines as string[]) {
        const w = C.windowRun(r, task, b, p);
        baselines[`${p}-${b}`] = summaryOf(w);
      }
      for (const p of cfg.policies as string[])
        for (const loss of cfg.losses as number[]) {
          runs[`${p}-${loss}-${b}`] = loss
            ? C.windowRun(r, task, b, p, "lossy", loss, cfg.seed as number)
            : C.windowRun(r, task, b, p);
          if (loss && (cfg.studies as string[]).includes(p))
            studies[`${p}-${loss}-${b}`] = C.compactionStudy(
              r,
              task,
              b,
              p,
              loss,
              seeds,
            );
        }
    }
    return {
      task: task.map((qi) => questionInfo(corpus, qi)),
      runs,
      baselines,
      studies,
    };
  }
  if (chapter === "memory") {
    const plan = C.memoryPlan(r);
    const runs: Obj = {};
    for (const [name, p] of Object.entries(C.MEMORY_POLICIES))
      runs[name] = C.memoryRun(r, p, plan, name);
    const sweep: Obj = {};
    for (const [name, p] of C.MEMORY_SWEEP)
      sweep[name] = summaryOf(C.memoryRun(r, p, plan, name));
    const qids = new Set<number>(plan.learn as number[]);
    for (const row of plan.probes as Obj[][])
      for (const p of row) qids.add(p.q as number);
    return {
      plan,
      runs,
      sweep,
      questions: Object.fromEntries(
        [...qids]
          .sort((a, b) => a - b)
          .map((qi) => [qi, questionInfo(corpus, qi)]),
      ),
    };
  }
  if (chapter === "tradeoff") {
    const sizes = C.measuredSizes(r);
    return C.tradeoff(
      r,
      [sizes.corpus as number].concat(cfg.sizes as number[]),
      cfg.ks as number[],
      cfg.questions as number,
    );
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
