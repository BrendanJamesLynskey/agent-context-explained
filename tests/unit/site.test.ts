/**
 * The small modules around the engine: number formats, captions for the rarer frames, the
 * palette, the chapter catalogue and the site constants.
 */
import { describe, expect, it } from "vitest";

import {
  chunkCaption,
  chunkSteps,
  cutAnswers,
  hybridCaption,
  windowCaption,
} from "@/lib/ctx/captions";
import {
  clip,
  fmtInt,
  fmtMs,
  fmtTokens,
  fmtUsd,
  pct,
  trim,
} from "@/lib/format";
import {
  SECTIONS,
  getSectionMeta,
  isValidSlug,
  readSectionMdx,
} from "@/lib/mdx/sections";
import { GITHUB_URL, SITE_URL, repoFile } from "@/lib/site";
import {
  ARTICLE_COLOUR,
  CHUNKER_COLOUR,
  KIND_COLOUR,
  KIND_NAME,
  STAGE_COLOUR,
  STAGE_NAME,
} from "@/lib/viz/palette";

describe("format", () => {
  it("durations", () => {
    expect(fmtMs(0)).toBe("0 s");
    expect(fmtMs(850)).toBe("850 ms");
    expect(fmtMs(12345)).toBe("12.3 s");
    expect(fmtMs(125_000)).toBe("2 min 5 s");
    expect(fmtMs(119_800)).toBe("2 min 0 s");
  });
  it("money, counts, percentages, clipping", () => {
    expect(fmtUsd(0)).toBe("$0");
    expect(fmtUsd(0.00236)).toBe("$0.00236");
    expect(fmtUsd(1.234)).toBe("$1.23");
    expect(fmtTokens(4342)).toBe("4,342 tokens");
    expect(fmtInt(1234.4)).toBe("1,234");
    expect(pct(0.531)).toBe("53%");
    expect(trim(0)).toBe("0");
    expect(clip("short")).toBe("short");
    expect(clip("a few words that will not fit in the space", 20)).toBe(
      "a few words that…",
    );
    expect(clip("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghi…");
  });
});

describe("captions", () => {
  const f = {
    caption: "question 1: reads chunk 3 (120 tokens) — it holds the answer",
    known: [4],
    used: 1234,
    budget: 1500,
    spent: 9876,
  };
  it("window", () => {
    expect(windowCaption(f)).toBe(
      "question 1: reads chunk 3 (120 tokens) — it holds the answer. Window 1,234 of 1,500 tokens; knows 1 fact; 9,876 input tokens spent.",
    );
    expect(windowCaption({ ...f, known: [] })).toMatch(/knows 0 facts/);
  });
  it("hybrid", () => expect(hybridCaption({ caption: "x" })).toBe("x"));
  it("chunking", () => {
    const view = {
      configs: {
        a: [
          { start: 0, end: 10, tokens: 3 },
          { start: 10, end: 20, tokens: 3 },
        ],
        b: [{ start: 0, end: 20, tokens: 6 }],
      },
      answers: [
        { q: 1, start: 8, end: 12 },
        { q: 2, start: 2, end: 4 },
      ],
    };
    expect(chunkSteps(view)).toEqual([
      { config: "a", index: 0 },
      { config: "a", index: 1 },
      { config: "b", index: 0 },
    ]);
    expect(cutAnswers(view, "a")).toEqual([1]);
    expect(cutAnswers(view, "b")).toEqual([]);
    expect(chunkCaption(view, { config: "a", index: 0 })).toBe(
      "a: chunk 1 of 2 here (3 tokens); holds 1 answer whole; cuts through 1 answer",
    );
    expect(chunkCaption(view, { config: "a", index: 1 })).toBe(
      "a: chunk 2 of 2 here (3 tokens); cuts through 1 answer",
    );
    expect(chunkCaption(view, { config: "b", index: 0 })).toBe(
      "b: chunk 1 of 1 here (6 tokens); holds 2 answers whole",
    );
  });
});

describe("palette", () => {
  it("every kind, stage, article and chunker has a colour", () => {
    for (const m of [KIND_COLOUR, STAGE_COLOUR, CHUNKER_COLOUR])
      for (const v of Object.values(m)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    expect(ARTICLE_COLOUR).toHaveLength(6);
    expect(Object.keys(KIND_NAME)).toEqual(Object.keys(KIND_COLOUR));
    expect(Object.keys(STAGE_NAME)).toEqual(Object.keys(STAGE_COLOUR));
  });
});

describe("chapters and site", () => {
  it("catalogue", async () => {
    expect(SECTIONS).toHaveLength(5);
    expect(isValidSlug("02-lexical-retrieval")).toBe(true);
    expect(isValidSlug("99-nope")).toBe(false);
    expect(getSectionMeta("05-chunking").title).toBe("Chunking");
    expect(await readSectionMdx("01-the-window-is-the-working-memory")).toMatch(
      /^<WindowWidget>/,
    );
  });
  it("constants", () => {
    expect(SITE_URL).toBe("https://agent-context-explained.vercel.app");
    expect(repoFile("README.md")).toBe(`${GITHUB_URL}/blob/main/README.md`);
  });
});
