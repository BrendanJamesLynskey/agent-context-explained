/**
 * The engine for code that runs in Node (server rendering, tests, scripts): the tokenizer and every
 * data file read from public/ on disk. The browser fetches the same files (engine.worker.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ctx, makeCorpus, Tokenizer, type Obj } from "./index";

let tok: Tokenizer | null = null;
let corpus: ReturnType<typeof makeCorpus> | null = null;

export function nodeTokenizer(): Tokenizer {
  if (!tok)
    tok = new Tokenizer(
      readFileSync(
        join(process.cwd(), "public/tokenizer/qwen2.5-merges.txt"),
        "utf8",
      ),
    );
  return tok;
}

export function nodeFiles(): Record<string, Obj> {
  const out: Record<string, Obj> = {};
  for (const n of ctx.FILES.concat(["manifest.json"]))
    out[n] = JSON.parse(
      readFileSync(join(process.cwd(), "public/context", n), "utf8"),
    ) as Obj;
  return out;
}

export function nodeCorpus(): ReturnType<typeof makeCorpus> {
  if (!corpus) corpus = makeCorpus(nodeFiles(), nodeTokenizer());
  return corpus;
}
