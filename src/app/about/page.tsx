/**
 * /about: what the site is, what the engine computes and what it leaves out, how the animations are
 * driven and checked, and where the data came from. Server Component, static.
 */
import Link from "next/link";

import VENDORED from "@/lib/engine/vendor/VENDORED.json";
import { formatValue, lookup } from "@/lib/ctx/values";
import {
  DECODER_URL,
  ENGINE_URL,
  GITHUB_URL,
  HARNESSES_URL,
  INFERENCE_URL,
  PROTOCOLS_URL,
  RAG_HUB,
  TRADEOFFS_URL,
  repoFile,
} from "@/lib/site";

export const metadata = {
  title: "About",
  description:
    "What Agent Context Explained's engine computes, what is illustrative, where the corpus and the models' outputs come from, and how Python and the browser are checked to agree exactly.",
};

const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

export default function AboutPage(): JSX.Element {
  const v = (path: string, fmt: Parameters<typeof formatValue>[1]) =>
    formatValue(lookup(path), fmt);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /about
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        About this site
      </h1>
      <div className="mdx-content mt-6">
        <p>
          Agent Context Explained is about context engineering: what goes into
          an agent&apos;s context window, and how an agent remembers beyond it.
          These first chapters cover the window as working memory and the
          retrieval that fills it: BM25, dense retrieval, hybrid fusion and
          reranking, and chunking. Every chapter is built around an animation.
          It is the third of a family of agent sites, after{" "}
          <a href={HARNESSES_URL} className={A}>
            Agent Harnesses Explained
          </a>{" "}
          and{" "}
          <a href={PROTOCOLS_URL} className={A}>
            Agent Protocols Explained
          </a>
          , next to the LLM-systems sites (the{" "}
          <a href={DECODER_URL} className={A}>
            Transformer Decoder Explainer
          </a>
          ,{" "}
          <a href={INFERENCE_URL} className={A}>
            LLM Inference Explained
          </a>
          ,{" "}
          <a href={TRADEOFFS_URL} className={A}>
            Inference Trade-offs Explained
          </a>{" "}
          and others, all in the header&apos;s switch).
        </p>

        <h2>Measured, not asserted</h2>
        <p>
          Every retrieval number is measured on a fixed, openly licensed corpus:{" "}
          {v("corpus.articles", "int")} articles of the SQuAD v1.1 development
          set ({v("corpus.tokens", "int")} tokens) and{" "}
          {v("corpus.questions", "int")} of their questions, sampled with a
          fixed seed from {v("corpus.pool", "int")}. Each question comes with
          its answer&apos;s exact position, so relevance needs no judgement: a
          chunk is relevant when it contains the whole answer. The{" "}
          <Link href="/data" className={A}>
            data page
          </Link>{" "}
          lists the sources, licences, model revisions and checksums, and the
          full results.
        </p>

        <h2>Models ran once, offline</h2>
        <p>
          No model runs on this site or in its CI. An embedding model
          (all-MiniLM-L6-v2) and a cross-encoder reranker
          (ms-marco-MiniLM-L6-v2) ran once, on a CPU, in the engine&apos;s build
          script. What ships is their output: 8-bit embeddings of every
          question, sentence and chunk, and the reranker&apos;s scores for{" "}
          {v("corpus.rerank_pairs", "int")} question–chunk pairs. From those
          files the engine recomputes everything else: chunk boundaries, BM25,
          cosine similarities, fusion, reranked orders, recall@k, MRR and nDCG,
          and the window task. The only numbers that need the unquantised
          vectors, the float32 baselines, were recorded by the offline run and
          are labelled as such.
        </p>

        <h2>The engine, and how the animations are checked</h2>
        <p>
          The engine is{" "}
          <a href={ENGINE_URL} className={A}>
            Agent_Loop_Sim
          </a>
          &apos;s context module (engine 1.4.0): a Python reference with a
          TypeScript port, vendored here at commit{" "}
          <code>{VENDORED.commit.slice(0, 7)}</code> with every file&apos;s
          SHA-256 recorded. It runs in a Web Worker. Agreement between the two
          languages is exact, with no tolerance: every chunk, score, ranking,
          metric and animation frame. Two details make that possible: all vector
          arithmetic is on integers (one square root and one division at the
          end, both correctly rounded), and BM25&apos;s logarithm is a shared
          transcription of fdlibm&apos;s, because the platform logarithms of
          Python and of browsers differ in the last bit for some inputs.
        </p>
        <ul>
          <li>
            In CI, the Python reference installed from the vendored commit
            regenerates{" "}
            <a
              href={repoFile("tests/fixtures/site_fixtures.json")}
              className={A}
            >
              this site&apos;s fixtures
            </a>{" "}
            (everything each chapter animates), and the unit tests require the
            vendored TS engine to reproduce them exactly.
          </li>
          <li>
            Every number in the prose is computed by the engine when the page is
            built, never typed in.
          </li>
          <li>
            Every code block in a chapter is cut from the vendored engine, and
            every equation compiles; end-to-end tests play, step, scrub and
            reset every animation in light and dark mode at desktop and phone
            widths, and check its captions at key steps against the Python
            reference&apos;s frames.
          </li>
        </ul>

        <h2>What is illustrative</h2>
        <ul>
          <li>
            The window task of chapter 1: a scripted agent, budgets scaled down
            to 1,000–3,000 tokens, and a summariser that keeps every fact by
            construction.
          </li>
          <li>
            The sentence splitter is a simple rule; the semantic chunker&apos;s
            threshold and the chunk sizes are choices.
          </li>
          <li>
            The 2-D map of chapter 3 is a projection for the eye; neighbours are
            found in all 384 dimensions.
          </li>
          <li>
            Token counts are Qwen2.5&apos;s (its tokenizer is vendored), not any
            other model&apos;s.
          </li>
        </ul>

        <h2>Accessibility</h2>
        <p>
          Every animation has keyboard controls (Space plays or pauses, the
          arrow keys step), a live caption read out by screen readers, and
          starts paused when the reader prefers reduced motion. Colours come
          from Okabe and Ito&apos;s colour-blind-safe palette, and nothing is
          told by colour alone: a relevant chunk is also ticked, a cut answer
          also hatched.
        </p>

        <h2>Source</h2>
        <p>
          The site&apos;s source is on{" "}
          <a href={GITHUB_URL} className={A}>
            GitHub
          </a>{" "}
          (MIT). For the slides behind the retrieval chapters, see the{" "}
          <a href={RAG_HUB} className={A}>
            RAG and retrieval
          </a>{" "}
          series.
        </p>
      </div>
    </main>
  );
}
