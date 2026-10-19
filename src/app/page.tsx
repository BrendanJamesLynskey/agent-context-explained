import type { Route } from "next";
import Link from "next/link";

import { CheckedStrip, StartButton } from "@/components/ui/Landing";
import { StageBars } from "@/components/viz/StageBars";
import { formatValue, lookup } from "@/lib/ctx/values";
import { SECTIONS } from "@/lib/mdx/sections";
import { ENGINE_URL, SQUAD_URL } from "@/lib/site";
import { ReadingOrder } from "@/components/ui/ReadingOrder";

const LINK =
  "focus-ring rounded underline decoration-accent/40 underline-offset-4 hover:decoration-accent";

/**
 * Landing page: what the site is, the picture behind the retrieval chapters (each stage's recall
 * on the labelled questions, computed by the engine at build time), and the ways in. Server
 * Component with no client JavaScript of its own.
 */
export default function HomePage(): JSX.Element {
  const v = (path: string, fmt: Parameters<typeof formatValue>[1]) =>
    formatValue(lookup(path), fmt);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        Agent Context Explained
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        What goes into the window, and how an agent remembers beyond it.
      </h1>
      <div className="mt-6 grid items-start gap-8 md:grid-cols-[1fr_minmax(0,24rem)]">
        <div>
          <p className="max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            An interactive guide to what goes into an agent&apos;s context
            window, retrieval and memory, with every number measured on a real
            corpus.
          </p>
          <div className="mt-6">
            <StartButton href={`/learn/${SECTIONS[0]!.slug}` as Route} />
          </div>
        </div>
        <figure
          data-hero-figure
          className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <StageBars />
          <figcaption className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            Recall at 1 and at 5 for each stage, over all{" "}
            {v("corpus.questions", "int")} questions (recursive 256-token
            chunks). Computed by the engine at build time.
          </figcaption>
        </figure>
      </div>
      <CheckedStrip href="/about#measured">
        Every retrieval number is measured on {v("corpus.questions", "int")}{" "}
        SQuAD questions with real MiniLM embeddings and recorded reranker
        scores, and the TypeScript engine in your browser reproduces the Python
        reference exactly, with no tolerance.
      </CheckedStrip>
      <section aria-labelledby="learn-heading" className="mt-12">
        <h2 id="learn-heading" className="text-xl font-semibold tracking-tight">
          What you&apos;ll learn
        </h2>
        <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
          A model knows only what is in its context window.{" "}
          <strong>Context engineering</strong> decides what goes in: which
          chunks of which documents, found how, cut where, packed in what order,
          what to drop or summarise when the window fills, and what to remember
          between sessions. Every claim here is measured, not asserted: on{" "}
          {v("corpus.articles", "int")} articles of{" "}
          <a href={SQUAD_URL} className={LINK}>
            SQuAD
          </a>{" "}
          and {v("corpus.questions", "int")} of their questions, each with its
          answer&apos;s exact place in the text, so a retriever either finds the
          chunk that holds the answer or does not.
        </p>
        <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
          The animations are driven by{" "}
          <a href={ENGINE_URL} className={LINK}>
            Agent_Loop_Sim
          </a>
          &apos;s context module. A small embedding model and a cross-encoder
          ran once, offline; their outputs ship with the site (int8 vectors and
          recorded scores), and the engine recomputes every chunk boundary,
          score, ranking and metric from them, identically in Python and in your
          browser. On this corpus BM25 finds the answer&apos;s chunk first{" "}
          {v("hybrid.evals.bm25.mean.recall@1", "pct")} of the time, dense
          retrieval {v("hybrid.evals.dense.mean.recall@1", "pct")}, the two
          fused {v("hybrid.evals.rrf.mean.recall@1", "pct")}, and fused then
          reranked {v("hybrid.evals.rerank.mean.recall@1", "pct")}. No language
          model runs anywhere.
        </p>
      </section>
      <ReadingOrder current="context" />
      <nav
        aria-label="Chapters"
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SECTIONS.map((s, i) => (
          <Link
            key={s.slug}
            href={`/learn/${s.slug}`}
            className="focus-ring group rounded-lg border border-neutral-200 p-5 hover:border-accent dark:border-neutral-800 dark:hover:border-indigo-400"
          >
            <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {s.summary}
            </p>
          </Link>
        ))}
      </nav>
      <p
        data-track-start
        className="mt-12 text-sm text-neutral-600 dark:text-neutral-400"
      >
        New to the Agents track?{" "}
        <a
          href="https://agent-harnesses-explained.vercel.app/agents"
          className="focus-ring rounded underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
        >
          Start here
        </a>
        : the six sites in reading order, what you need first, and a glossary of
        the terms they define.
      </p>
      <p className="mt-12 text-sm text-neutral-600 dark:text-neutral-400">
        Part of a family of sixteen companion sites in four tracks, all in the
        site menu above: Foundations (
        <a
          href="https://transformer-decoder-explained.vercel.app"
          className={LINK}
        >
          Decoder
        </a>
        ,{" "}
        <a
          href="https://transformer-training-explained.vercel.app"
          className={LINK}
        >
          Training
        </a>
        ), Hardware (
        <a href="https://gpu-kernels-explained.vercel.app" className={LINK}>
          Kernels
        </a>
        ,{" "}
        <a href="https://systolic-arrays-explained.vercel.app" className={LINK}>
          Systolic
        </a>
        ,{" "}
        <a href="https://ai-accelerators-explained.vercel.app" className={LINK}>
          Accelerators
        </a>
        ,{" "}
        <a href="https://ai-racks-explained.vercel.app" className={LINK}>
          Racks
        </a>
        ), Inference (
        <a href="https://llm-inference-explained.vercel.app" className={LINK}>
          Serving
        </a>
        ,{" "}
        <a
          href="https://llm-architectures-explained.vercel.app"
          className={LINK}
        >
          Architectures
        </a>
        ,{" "}
        <a href="https://numerics-explained.vercel.app" className={LINK}>
          Numerics
        </a>
        ,{" "}
        <a
          href="https://inference-tradeoffs-explained.vercel.app"
          className={LINK}
        >
          Trade-offs
        </a>
        ) and Agents (
        <a href="https://agent-harnesses-explained.vercel.app" className={LINK}>
          Harnesses
        </a>
        ,{" "}
        <a href="https://agent-protocols-explained.vercel.app" className={LINK}>
          Protocols
        </a>
        , <strong className="font-medium">Context</strong>,{" "}
        <a
          href="https://agent-orchestration-explained.vercel.app"
          className={LINK}
        >
          Orchestration
        </a>
        ,{" "}
        <a href="https://agent-evals-explained.vercel.app" className={LINK}>
          Evals
        </a>
        ,{" "}
        <a href="https://agent-security-explained.vercel.app" className={LINK}>
          Security
        </a>
        ). It is the third of the six agent sites. How this one was built, and
        how to check it:{" "}
        <Link href="/about" className={LINK}>
          about
        </Link>
        .
      </p>
    </main>
  );
}
