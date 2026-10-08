/**
 * Every number the prose quotes is computed by the engine: each <V of="…"> path in the chapters
 * (and the paths the home and about pages use) resolves, and spot values match the engine's
 * recorded results (fixtures/context_results.md in Agent_Loop_Sim, vendored as
 * src/data/context_results.md).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatValue, lookup, tree } from "@/lib/ctx/values";

const ROOT = path.join(__dirname, "../..");
const DIR = path.join(ROOT, "content/chapters");
const SOURCES = [
  ...readdirSync(DIR).map((f) => readFileSync(path.join(DIR, f), "utf8")),
  readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8"),
  readFileSync(path.join(ROOT, "src/app/about/page.tsx"), "utf8"),
];
const RESULTS = readFileSync(
  path.join(ROOT, "src/data/context_results.md"),
  "utf8",
);

describe("values", () => {
  it("every path in the prose resolves", () => {
    const paths = new Set<string>();
    for (const s of SOURCES) {
      for (const m of s.matchAll(/<V of="([^"]+)"/g)) paths.add(m[1]!);
      for (const m of s.matchAll(/v\("([^"]+)"/g)) paths.add(m[1]!);
    }
    expect(paths.size).toBeGreaterThan(30);
    for (const p of paths) expect(() => lookup(p), p).not.toThrow();
  });

  it("keys with hyphens and dots resolve, missing ones throw", () => {
    expect(lookup("window.runs.unbounded-1500.recalled")).toBe(12);
    expect(lookup("hybrid.evals.rerank.mean.recall@1")).toBeGreaterThan(0.5);
    expect(() => lookup("window.nope")).toThrow(/no value/);
    expect(() => lookup("corpus.articles.x")).toThrow(/no value/);
  });

  it("spot values match the engine's recorded results", () => {
    const row = (config: string, method: string) => {
      const line = RESULTS.split("\n").find((l) =>
        l.startsWith(`| ${config} | ${method} |`),
      );
      return line!
        .split("|")
        .slice(3, 10)
        .map((x) => Number(x.trim()));
    };
    const m = (e: string) => {
      const x = lookup(e) as Record<string, number>;
      return [
        "recall@1",
        "recall@3",
        "recall@5",
        "recall@10",
        "recall@20",
        "mrr@10",
        "ndcg@10",
      ].map((k) => Number(x[k]!.toFixed(3)));
    };
    expect(m("hybrid.evals.bm25.mean")).toEqual(row("recursive-256", "bm25"));
    expect(m("hybrid.evals.dense.mean")).toEqual(
      row("recursive-256", "dense precision=int8"),
    );
    expect(m("hybrid.evals.rrf.mean")).toEqual(row("recursive-256", "rrf"));
    expect(m("hybrid.evals.rerank.mean")).toEqual(
      row("recursive-256", "rerank n=20"),
    );
    expect(m("dense.evals.binary.mean")).toEqual(
      row("recursive-256", "dense precision=binary"),
    );
    expect(m("chunking.table.fixed-512.dense.mean")).toEqual(
      row("fixed-512", "dense precision=int8"),
    );
    expect(lookup("corpus.questions")).toBe(200);
    expect(lookup("corpus.tokens")).toBe(37499);
    expect(tree()).toBe(tree());
  });

  it("formats", () => {
    expect(formatValue(1234, "int")).toBe("1,234");
    expect(formatValue(0.395, "pct")).toBe("40%");
    expect(formatValue(193.5, "num")).toBe("194");
    expect(formatValue(0.78549, "f3")).toBe("0.785");
    expect(formatValue(0.785, "f2")).toBe("0.79");
    expect(formatValue("x", "raw")).toBe("x");
  });
});
