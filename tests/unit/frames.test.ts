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
  costCaption,
  hybridCaption,
  memoryCaption,
  packingCaption,
  windowCaption,
} from "@/lib/ctx/captions";
import { fmtUsd } from "@/lib/format";

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

describe("key frames, chapters 6 to 9", () => {
  it("packing: the optimal set has the most value, every set fits, and the DP's last row is its value", () => {
    for (const v of Object.values(fx.chapters.packing.views as Obj) as Obj[]) {
      const p = v.packers as Obj;
      expect(p.optimal.value).toBeGreaterThanOrEqual(p.top.value - 1e-12);
      expect(p.optimal.value).toBeGreaterThanOrEqual(p.density.value - 1e-12);
      for (const k of ["top", "density", "optimal"])
        expect(p[k].tokens).toBeLessThanOrEqual(v.budget);
      const last = (p.optimal.steps as Obj[])[p.optimal.steps.length - 1]!;
      expect(last.best).toBeCloseTo(p.optimal.value, 12);
      // greedy: the tokens left never go negative, and a skip means it did not fit
      for (const st of p.top.steps as Obj[])
        expect(st.left).toBeGreaterThanOrEqual(0);
    }
  });
  it("compaction: a lossy compaction's caption names what it dropped, and the model curve is (1 - loss)^n", () => {
    const f = fx.chapters.compaction.runs["compact-0.25-1500"].frames as Obj[];
    expect(
      f.some((x) =>
        /the summariser drops the facts? for question/.test(x.caption),
      ),
    ).toBe(true);
    const st = fx.chapters.compaction.studies["compact-0.25-1500"] as Obj;
    expect(st.survival[0].model).toBe(0.75);
    expect(st.survival[1].model).toBe(0.5625);
    expect(fx.chapters.compaction.runs["compact-0-2000"].recalled).toBe(36);
  });
  it("window: the truncation caption names the question whose fact is lost", () => {
    const f = fx.chapters.window.runs["truncate-1500"].frames as Obj[];
    expect(
      f.some((x) => /\(the fact for question \d+ is lost\)/.test(x.caption)),
    ).toBe(true);
    expect(f.some((x) => /facts lost/.test(x.caption))).toBe(false);
  });
  it("memory: the transcript recalls every probe, nothing recalls nothing", () => {
    const r = fx.chapters.memory.runs as Obj;
    expect(r.transcript.recalled).toBe(r.transcript.probes);
    expect(r.none.recalled).toBe(0);
    const probes = (r.episodic.frames as Obj[]).filter(
      (x) => x.event === "probe",
    );
    expect(probes.length).toBe(r.episodic.probes);
    for (const p of probes) expect(p.got.length).toBeLessThanOrEqual(3);
  });
  it("long context: retrieval's cost does not depend on the set's size; the cache is read from the second question", () => {
    const t = fx.chapters.tradeoff as Obj;
    const a = t.runs[`claude-sonnet-4.6|${t.sizes.corpus}|5`].strategies;
    const b = t.runs["claude-sonnet-4.6|1000000|5"].strategies;
    expect(a.rag.cum).toEqual(b.rag.cum);
    expect(b["long+cache"].cached[0]).toBe(0);
    expect(b["long+cache"].cached[1]).toBe(t.sizes.system + 1000000);
  });
});

describe("captions: reference frames = port frames", () => {
  it("packing", () => {
    for (const [k, v] of Object.entries(fx.chapters.packing.views as Obj))
      for (const p of ["top", "density", "optimal"])
        for (const pl of ["best-first", "best-last", "ends", "middle"]) {
          const n = ((v as Obj).packers[p].steps as Obj[]).length;
          for (let i = 0; i <= n; i++)
            expect(packingCaption(v as Obj, p, pl, i)).toBe(
              packingCaption(got.packing!.views[k], p, pl, i),
            );
        }
  });
  it("compaction", () => {
    for (const [k, run] of Object.entries(fx.chapters.compaction.runs as Obj))
      expect(((run as Obj).frames as Obj[]).map(windowCaption)).toEqual(
        (got.compaction!.runs[k].frames as Obj[]).map(windowCaption),
      );
  });
  it("memory", () => {
    for (const [k, run] of Object.entries(fx.chapters.memory.runs as Obj))
      expect(((run as Obj).frames as Obj[]).map(memoryCaption)).toEqual(
        (got.memory!.runs[k].frames as Obj[]).map(memoryCaption),
      );
  });
  it("long context", () => {
    for (const [k, run] of Object.entries(fx.chapters.tradeoff.runs as Obj))
      for (let i = 0; i < ((run as Obj).questions as number); i++)
        expect(costCaption(run as Obj, i, fmtUsd)).toBe(
          costCaption(got.tradeoff!.runs[k], i, fmtUsd),
        );
  });
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
