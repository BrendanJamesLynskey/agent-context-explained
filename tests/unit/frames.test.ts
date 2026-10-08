/**
 * Frame tests (visual standard §4). Everything a chapter animates is recomputed by the vendored
 * TS engine from the shipped data and must equal the Python reference's
 * (tests/fixtures/site_fixtures.json, written by scripts/make_fixtures.py from the reference at the
 * vendored commit), with no tolerance: the window task under every budget and policy, BM25 views,
 * nearest-neighbour frames at each precision, RRF and rerank frames, chunk boundaries and every
 * metric. Then key frames are checked one by one, and the site's own captions are built from the
 * reference's frames and from the port's, and must agree on every step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHAPTER_CONFIGS,
  runChapter,
  type Chapter,
  type Obj,
} from "@/lib/engine";
import { nodeCorpus } from "@/lib/engine/node";
import {
  chunkSteps,
  chunkCaption,
  hybridCaption,
  windowCaption,
} from "@/lib/ctx/captions";

const fx = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/site_fixtures.json"), "utf8"),
) as Obj;
const corpus = nodeCorpus();
const json = (x: unknown) => JSON.parse(JSON.stringify(x)) as Obj;
const got: Record<string, Obj> = {};
for (const ch of Object.keys(CHAPTER_CONFIGS) as Chapter[])
  got[ch] = json(runChapter(ch, corpus));

describe("fixtures", () => {
  it("cover every chapter", () => {
    expect(Object.keys(fx.chapters).sort()).toEqual(
      Object.keys(CHAPTER_CONFIGS).sort(),
    );
  });
  for (const ch of Object.keys(CHAPTER_CONFIGS)) {
    it(`${ch}: everything the chapter animates equals the reference`, () => {
      expect(got[ch]).toEqual(fx.chapters[ch]);
    });
  }
});

describe("key frames", () => {
  const w = fx.chapters.window as Obj;
  it("window: the first frame is the system prompt and the task, the last the answers", () => {
    const run = w.runs["truncate-1500"] as Obj;
    const f = run.frames as Obj[];
    expect(f[0]!.event).toBe("start");
    expect((f[0]!.items as Obj[]).map((i) => i.kind)).toEqual([
      "system",
      "task",
    ]);
    expect(f[f.length - 1]!.event).toBe("answer");
    expect(f[f.length - 1]!.known.length).toBe(run.recalled);
  });
  it("window: a truncation drops the oldest read and the facts it held", () => {
    const f = (w.runs["truncate-1500"] as Obj).frames as Obj[];
    const i = f.findIndex((x) => x.event === "truncate");
    expect(i).toBeGreaterThan(0);
    const before = (f[i - 1]!.items as Obj[]).filter((x) => x.kind === "read");
    const after = (f[i]!.items as Obj[]).filter((x) => x.kind === "read");
    expect(after.length).toBe(before.length - 1);
    expect(after[0]!.id).toBe(before[1]!.id);
  });
  it("window: compaction keeps every fact in a summary", () => {
    const f = (w.runs["compact-1500"] as Obj).frames as Obj[];
    const i = f.findIndex((x) => x.event === "compact");
    const s = (f[i]!.items as Obj[]).find((x) => x.kind === "summary")!;
    expect(f[i]!.known).toEqual(
      [...new Set([...(f[i - 1]!.known as number[])])].sort((a, b) => a - b),
    );
    expect(s.facts.length).toBeGreaterThan(0);
  });
  it("lexical: the last frame's leader is the view's top chunk", () => {
    const v = Object.values(fx.chapters.lexical.views as Obj)[0] as Obj;
    const last = (v.frames as Obj[])[(v.frames as Obj[]).length - 1]!;
    expect(last.top[0].chunk).toBe(v.top[0].chunk);
    expect(last.top[0].score).toBe(v.top[0].score);
  });
  it("dense: binary is never better than int8 at recall@5 here, and int8 is within 0.01 of float32", () => {
    const d = fx.chapters.dense as Obj;
    expect(d.evals.binary.mean["recall@5"]).toBeLessThanOrEqual(
      d.evals.int8.mean["recall@5"],
    );
    expect(
      Math.abs(d.evals.int8.mean["recall@5"] - d.float32["recall@5"]),
    ).toBeLessThanOrEqual(0.01);
  });
  it("hybrid: the RRF frame adds 1/(60+rank) to each list's chunk at that rank", () => {
    const h = Object.values(fx.chapters.hybrid.hybrid as Obj)[0] as Obj;
    const f0 = (h.frames as Obj[])[0]!;
    expect(f0.adds).toEqual([h.bm25[0], h.dense[0]]);
    const sum = (f0.top as Obj[]).reduce((a, t) => a + (t.score as number), 0);
    expect(sum).toBeCloseTo(2 / 61, 12);
  });
});

describe("captions: reference frames = port frames", () => {
  for (const [k, run] of Object.entries(fx.chapters.window.runs as Obj)) {
    it(`window ${k}`, () => {
      const a = (run as Obj).frames as Obj[];
      const b = got.window!.runs[k].frames as Obj[];
      expect(a.map((f) => windowCaption(f))).toEqual(
        b.map((f) => windowCaption(f)),
      );
    });
  }
  it("hybrid", () => {
    for (const [q, h] of Object.entries(fx.chapters.hybrid.hybrid as Obj))
      expect(((h as Obj).frames as Obj[]).map(hybridCaption)).toEqual(
        (got.hybrid!.hybrid[q].frames as Obj[]).map(hybridCaption),
      );
  });
  it("chunking", () => {
    const a = chunkSteps(fx.chapters.chunking.view as Obj);
    const b = chunkSteps(got.chunking!.view as Obj);
    expect(
      a.map((s) => chunkCaption(fx.chapters.chunking.view as Obj, s)),
    ).toEqual(b.map((s) => chunkCaption(got.chunking!.view as Obj, s)));
  });
});
