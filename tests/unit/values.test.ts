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
    expect(formatValue(0.965, "pct1")).toBe("96.5%");
    expect(formatValue(150.04455, "usd")).toBe("$150.04");
    expect(formatValue(0.0036, "usd")).toBe("$0.0036");
    expect(formatValue(200409, "s")).toBe("200 s");
  });
});

describe("chapters 6 to 9 against the engine's recorded results, part 2", () => {
  const R2 = readFileSync(
    path.join(ROOT, "src/data/context2_results.md"),
    "utf8",
  );
  it("packing, compaction, memory and long-context numbers match context2_results.md", () => {
    const top = lookup("packing.eval.results.512.top") as Record<
      string,
      number
    >;
    expect(R2).toContain(
      `| 512 | top | ${top.answered!.toFixed(3)} | ${top.tokens!.toFixed(1)} | ${top.value!.toFixed(3)} |`,
    );
    const st = lookup("compaction.studies.compact-0.25-1500") as {
      recalled: number;
      survival: { measured: number; model: number }[];
    };
    expect(R2).toContain(
      `| 1500 | compact | 0.25 | ${st.recalled.toFixed(2)} of 36 |`,
    );
    expect(R2).toContain(
      `| ${st.survival[4]!.measured.toFixed(3)} | ${st.survival[4]!.model.toFixed(3)} |`,
    );
    const m = lookup("memory.runs.semantic") as Record<string, number>;
    expect(R2).toContain(
      `| semantic | ${m.recalled} of ${m.probes} | 17 of 18 | 2 of 4 | ${m.read_tokens} | ${m.write_tokens} | ${m.stored_tokens} |`,
    );
    const cum = lookup(
      "tradeoff.runs.claude-sonnet-4.6|1000000|5.strategies.long+cache.cum.49",
    ) as number;
    expect(R2).toContain(`| ${cum.toFixed(3)} |`);
  });
});
