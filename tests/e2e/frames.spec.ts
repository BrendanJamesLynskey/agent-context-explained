/**
 * Frame tests on the page (visual standard §4): set key frames of every animation and require
 * the caption on screen to be the caption built from the Python reference's frame
 * (tests/fixtures/site_fixtures.json).
 */
import { expect, test, type Locator } from "@playwright/test";

import fx from "../fixtures/site_fixtures.json";

import {
  chunkCaption,
  chunkSteps,
  costCaption,
  memoryCaption,
  packingCaption,
  windowCaption,
} from "@/lib/ctx/captions";
import { fmtUsd } from "@/lib/format";
import type { Obj } from "@/lib/engine/vendor/index";

import { ENGINE_TIMEOUT } from "./pages";

// No autoplay (reduced motion): the test sets each frame itself.
test.use({ contextOptions: { reducedMotion: "reduce" } });

const CH = (fx as Obj).chapters as Obj;

async function change(fig: Locator, act: () => Promise<void>): Promise<void> {
  const before = (await fig.getAttribute("data-key")) ?? "";
  await act();
  await expect(fig).not.toHaveAttribute("data-key", before);
}

async function frame(fig: Locator, i: number, want: string): Promise<void> {
  await fig.getByTestId("scrub").fill(String(i));
  await expect(fig).toHaveAttribute("data-step", String(i));
  await expect(fig.getByTestId("caption")).toHaveText(want);
}

function keySteps(n: number): number[] {
  return [...new Set([0, 1, Math.floor(n / 2), n - 1])];
}

type Case = {
  path: string;
  id: string;
  name: string;
  captions: string[];
  choose?: (fig: Locator) => Promise<void>;
};

const radio =
  (...names: string[]) =>
  async (fig: Locator) => {
    for (const n of names)
      await change(fig, async () => {
        await fig.getByRole("radio", { name: n, exact: true }).click();
      });
  };

const LEX = CH.lexical as Obj;
const q0 = (LEX.questions as Obj[])[0]!.question as string;
const free1 = (LEX.free as string[])[1]!;
const HY = CH.hybrid as Obj;
const qLast = (HY.questions as Obj[])[(HY.questions as Obj[]).length - 1]!
  .q as number;
const view = (CH.chunking as Obj).view as Obj;
const PK = CH.packing as Obj;
const pq0 = (PK.questions as Obj[])[0]!.q as number;
const pqLast = (PK.questions as Obj[])[(PK.questions as Obj[]).length - 1]!
  .q as number;
const packCaps = (key: string, packer: string, placement: string) => {
  const v = PK.views[key] as Obj;
  const n = (v.packers[packer].steps as Obj[]).length;
  return Array.from({ length: n + 1 }, (_, i) =>
    packingCaption(v, packer, placement, i),
  );
};
const TR = CH.tradeoff as Obj;
const costCaps = (key: string) => {
  const run = TR.runs[key] as Obj;
  return Array.from({ length: run.questions as number }, (_, i) =>
    costCaption(run, i, fmtUsd),
  );
};

const CASES: Case[] = [
  {
    path: "/learn/01-the-window-is-the-working-memory",
    id: "window-widget",
    name: "truncate at 1,500 tokens",
    captions: (CH.window.runs["truncate-1500"].frames as Obj[]).map(
      windowCaption,
    ),
  },
  {
    path: "/learn/01-the-window-is-the-working-memory",
    id: "window-widget",
    name: "compact at 1,000 tokens",
    captions: (CH.window.runs["compact-1000"].frames as Obj[]).map(
      windowCaption,
    ),
    choose: radio("compact", "1000"),
  },
  {
    path: "/learn/01-the-window-is-the-working-memory",
    id: "window-widget",
    name: "retrieve at 2,000 tokens",
    captions: (CH.window.runs["retrieve-2000"].frames as Obj[]).map(
      windowCaption,
    ),
    choose: radio("retrieve", "2000"),
  },
  {
    path: "/learn/02-lexical-retrieval",
    id: "bm25-widget",
    name: "the first question",
    captions: (LEX.views[q0].frames as Obj[]).map((f) => f.caption as string),
  },
  {
    path: "/learn/02-lexical-retrieval",
    id: "bm25-widget",
    name: "a typed-style query",
    captions: (LEX.views[free1].frames as Obj[]).map(
      (f) => f.caption as string,
    ),
    choose: async (fig) => {
      await change(fig, async () => {
        await fig.getByLabel("Query", { exact: true }).selectOption("f1");
      });
    },
  },
  {
    path: "/learn/03-dense-retrieval",
    id: "dense-widget",
    name: "int8",
    captions: (CH.dense.frames.int8 as Obj[]).map((f) => f.caption as string),
  },
  {
    path: "/learn/03-dense-retrieval",
    id: "dense-widget",
    name: "binary",
    captions: (CH.dense.frames.binary as Obj[]).map((f) => f.caption as string),
    choose: radio("binary"),
  },
  {
    path: "/learn/04-hybrid-and-reranking",
    id: "hybrid-widget",
    name: "the first question",
    captions: (
      HY.hybrid[(HY.questions as Obj[])[0]!.q as number].frames as Obj[]
    ).map((f) => f.caption as string),
  },
  {
    path: "/learn/04-hybrid-and-reranking",
    id: "hybrid-widget",
    name: "the last question",
    captions: (HY.hybrid[qLast].frames as Obj[]).map(
      (f) => f.caption as string,
    ),
    choose: async (fig) => {
      await change(fig, async () => {
        await fig
          .getByLabel("Question", { exact: true })
          .selectOption(String(qLast));
      });
    },
  },
  {
    path: "/learn/05-chunking",
    id: "chunk-widget",
    name: "three chunkers",
    captions: chunkSteps(view).map((st) => chunkCaption(view, st)),
  },
  {
    path: "/learn/01-the-window-is-the-working-memory",
    id: "window-widget",
    name: "compact with the lossy summariser at 1,500 tokens",
    captions: (CH.window.runs["lossy-compact-1500"].frames as Obj[]).map(
      windowCaption,
    ),
    choose: radio("compact", "lossy (25% loss)"),
  },
  {
    path: "/learn/06-packing-the-window",
    id: "packing-widget",
    name: "top packer, placed ends",
    captions: packCaps(`${pq0}-512`, "top", "ends"),
  },
  {
    path: "/learn/06-packing-the-window",
    id: "packing-widget",
    name: "the optimal packer on the last question at 1,024 tokens",
    captions: packCaps(`${pqLast}-1024`, "optimal", "middle"),
    choose: async (fig) => {
      await change(fig, async () => {
        await fig
          .getByLabel("Question", { exact: true })
          .selectOption(String(pqLast));
      });
      await radio("1024", "optimal", "middle")(fig);
    },
  },
  {
    path: "/learn/07-compaction-and-summarisation",
    id: "compaction-widget",
    name: "lossy summariser, loss 0.25, 1,500 tokens",
    captions: (CH.compaction.runs["compact-0.25-1500"].frames as Obj[]).map(
      windowCaption,
    ),
  },
  {
    path: "/learn/07-compaction-and-summarisation",
    id: "compaction-widget",
    name: "re-retrieval, loss 0.5, 2,000 tokens",
    captions: (
      CH.compaction.runs["compact+retrieve-0.5-2000"].frames as Obj[]
    ).map(windowCaption),
    choose: radio("2000", "0.5", "compact+retrieve"),
  },
  {
    path: "/learn/08-agent-memory",
    id: "memory-widget",
    name: "episodic memory",
    captions: (CH.memory.runs.episodic.frames as Obj[]).map(memoryCaption),
  },
  {
    path: "/learn/08-agent-memory",
    id: "memory-widget",
    name: "semantic memory with a cap",
    captions: (CH.memory.runs["semantic-cap"].frames as Obj[]).map(
      memoryCaption,
    ),
    choose: async (fig) => {
      await change(fig, async () => {
        await fig
          .getByLabel("Memory policy", { exact: true })
          .selectOption("semantic-cap");
      });
    },
  },
  {
    path: "/learn/09-long-context-or-retrieval",
    id: "cost-widget",
    name: "Sonnet, a 1M-token set, top 5",
    captions: costCaps("claude-sonnet-4.6|1000000|5"),
  },
  {
    path: "/learn/09-long-context-or-retrieval",
    id: "cost-widget",
    name: "GPT-5 mini, the corpus, top 20",
    captions: costCaps(`gpt-5-mini|${TR.sizes.corpus as number}|20`),
    choose: async (fig) => {
      await change(fig, async () => {
        await fig
          .getByLabel("Model (list price)", { exact: true })
          .selectOption("gpt-5-mini");
      });
      await radio("37K (corpus)", "20")(fig);
    },
  },
];

for (const c of CASES) {
  test(`${c.id}: ${c.name} shows the reference's captions at key frames`, async ({
    page,
  }) => {
    await page.goto(c.path);
    const fig = page.getByTestId(c.id);
    await expect(fig).toBeVisible({ timeout: ENGINE_TIMEOUT });
    await fig.scrollIntoViewIfNeeded();
    if (c.choose) await c.choose(fig);
    await expect(fig.getByTestId("scrub")).toHaveAttribute(
      "max",
      String(c.captions.length - 1),
    );
    for (const i of keySteps(c.captions.length))
      await frame(fig, i, c.captions[i]!);
  });
}
