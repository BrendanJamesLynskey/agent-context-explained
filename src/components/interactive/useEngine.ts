"use client";

/**
 * Everything a chapter animates, computed by the vendored engine in a Web Worker (one shared
 * worker, which fetches the tokenizer and the data files it needs). Falls back to the main thread
 * if workers are unavailable. Results are cached per chapter for the page's lifetime; a BM25 query
 * is one more round trip.
 */
import { useEffect, useState } from "react";

import type { Chapter, ChapterData, Obj, context } from "@/lib/engine";

export type EngineState =
  | { status: "loading" }
  | { status: "ready"; data: ChapterData }
  | { status: "error"; error: string };

type Req =
  | { op: "chapter"; chapter: Chapter }
  | { op: "bm25"; query: string; k1: number; b: number };

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<
  number,
  { resolve: (r: Obj) => void; reject: (e: Error) => void }
>();
const cache = new Map<Chapter, Promise<ChapterData>>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(
      new URL("../../lib/engine/engine.worker.ts", import.meta.url),
    );
    worker.onmessage = (
      e: MessageEvent<{ id: number; data?: Obj; error?: string }>,
    ) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.data) w.resolve(e.data.data);
      else w.reject(new Error(e.data.error ?? "engine failed"));
    };
  } catch {
    worker = null;
  }
  return worker;
}

let mainCorpus: Promise<context.Corpus> | null = null;

async function mainThread(req: Req): Promise<Obj> {
  const E = await import("@/lib/engine");
  mainCorpus ??= (async () => {
    const merges = await fetch(E.MERGES_URL).then((r) => r.text());
    const files: Record<string, Obj> = {};
    for (const n of E.ctx.FILES.concat(["manifest.json"]))
      files[n] = (await fetch(E.DATA_URL + n).then((r) => r.json())) as Obj;
    return E.makeCorpus(files, new E.Tokenizer(merges));
  })();
  const c = await mainCorpus;
  return req.op === "chapter"
    ? E.runChapter(req.chapter, c)
    : E.bm25Query(c, req.query, req.k1, req.b);
}

function ask(req: Req): Promise<Obj> {
  const w = getWorker();
  if (!w) return mainThread(req);
  return new Promise<Obj>((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    w.postMessage({ id, ...req });
  });
}

export function loadChapter(chapter: Chapter): Promise<ChapterData> {
  let p = cache.get(chapter);
  if (!p) {
    p = ask({ op: "chapter", chapter });
    cache.set(chapter, p);
  }
  return p;
}

export function bm25Remote(query: string, k1: number, b: number): Promise<Obj> {
  return ask({ op: "bm25", query, k1, b });
}

export function useEngine(chapter: Chapter): EngineState {
  const [state, setState] = useState<EngineState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    loadChapter(chapter).then(
      (data) => live && setState({ status: "ready", data }),
      (e: Error) => live && setState({ status: "error", error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [chapter]);
  return state;
}
