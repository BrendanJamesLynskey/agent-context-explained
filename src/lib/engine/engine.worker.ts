/**
 * Runs the engine off the main thread. Answers { id, op: "chapter", chapter } with everything that
 * chapter animates, and { id, op: "bm25", query, k1, b } with a BM25 view for a typed query. The
 * tokenizer (151k merges) and the engine's data files are fetched once each, only when a chapter
 * needs them.
 */
import {
  DATA_URL,
  MERGES_URL,
  Tokenizer,
  bm25Query,
  filesFor,
  makeCorpus,
  runChapter,
  type Chapter,
  type Obj,
} from "./index";

type Req =
  | { id: number; op: "chapter"; chapter: Chapter }
  | { id: number; op: "bm25"; query: string; k1: number; b: number };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage: (m: unknown) => void;
};

let tok: Promise<Tokenizer> | null = null;
const files: Record<string, Obj> = {};
const pending = new Map<string, Promise<void>>();
let corpus: ReturnType<typeof makeCorpus> | null = null;

async function getText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

function need(names: string[]): Promise<void[]> {
  return Promise.all(
    names.map((n) => {
      let p = pending.get(n);
      if (!p) {
        p = getText(DATA_URL + n).then((t) => {
          files[n] = JSON.parse(t) as Obj;
        });
        pending.set(n, p);
      }
      return p;
    }),
  );
}

async function getCorpus(names: string[]) {
  tok ??= getText(MERGES_URL).then((x) => new Tokenizer(x));
  const [t] = await Promise.all([tok, need(names)]);
  // the corpus reads `files` by reference, so files fetched later are seen too
  corpus ??= makeCorpus(files, t);
  return corpus;
}

ctx.onmessage = async (e) => {
  const req = e.data;
  try {
    if (req.op === "chapter") {
      const c = await getCorpus(filesFor(req.chapter));
      ctx.postMessage({ id: req.id, data: runChapter(req.chapter, c) });
    } else {
      const c = await getCorpus(["corpus.json"]);
      ctx.postMessage({
        id: req.id,
        data: bm25Query(c, req.query, req.k1, req.b),
      });
    }
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
