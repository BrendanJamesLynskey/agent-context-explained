/**
 * /data: where the corpus and the model outputs come from (sources, licences, revisions,
 * checksums), and every retrieval result, computed by the engine at build time. Server Component.
 */
import type { Obj } from "@/lib/engine";
import { formatValue, lookup } from "@/lib/ctx/values";
import {
  CC_BY_SA,
  EMBEDDER_URL,
  ENGINE_URL,
  RERANKER_URL,
  SQUAD_PAPER,
  SQUAD_URL,
} from "@/lib/site";

export const metadata = {
  title: "Data",
  description:
    "The corpus (a SQuAD v1.1 subset, CC BY-SA 4.0), the embedding model and the reranker that ran offline, every shipped file's checksum, and every retrieval result on the 200 labelled questions.",
};

const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";
const METRICS = [
  "recall@1",
  "recall@3",
  "recall@5",
  "recall@10",
  "mrr@10",
  "ndcg@10",
];

function Row({
  name,
  m,
  lost,
}: {
  name: string;
  m: Obj;
  lost?: number;
}): JSX.Element {
  return (
    <tr>
      <td className="py-1 pr-3">{name}</td>
      {METRICS.map((k) => (
        <td key={k} className="py-1 pr-3 font-mono">
          {(m[k] as number).toFixed(3)}
        </td>
      ))}
      {lost !== undefined && <td className="py-1 pr-3 font-mono">{lost}</td>}
    </tr>
  );
}

function Head({ lost }: { lost?: boolean }): JSX.Element {
  return (
    <thead>
      <tr className="text-left text-neutral-600 dark:text-neutral-400">
        <th className="py-1 pr-3 font-medium">what</th>
        {METRICS.map((k) => (
          <th key={k} className="py-1 pr-3 font-medium">
            {k}
          </th>
        ))}
        {lost && <th className="py-1 pr-3 font-medium">lost</th>}
      </tr>
    </thead>
  );
}

export default function DataPage(): JSX.Element {
  const v = (path: string, fmt: Parameters<typeof formatValue>[1]) =>
    formatValue(lookup(path), fmt);
  const man = lookup("manifest") as Obj;
  const ev = lookup("hybrid.evals") as Obj;
  const dv = lookup("dense.evals") as Obj;
  const table = lookup("chunking.table") as Obj;
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /data
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        The corpus, the models and the results
      </h1>
      <div className="mdx-content mt-6">
        <h2>The corpus</h2>
        <p>
          {v("corpus.articles", "int")} articles of the{" "}
          <a href={SQUAD_URL} className={A}>
            SQuAD v1.1
          </a>{" "}
          development set (Rajpurkar, Zhang, Lopyrev and Liang,{" "}
          <a href={SQUAD_PAPER} className={A}>
            EMNLP 2016
          </a>
          ), licensed{" "}
          <a href={CC_BY_SA} className={A}>
            CC BY-SA 4.0
          </a>
          :{" "}
          {(man.corpus.articles as string[])
            .map((a) => a.replace(/_/g, " "))
            .join(", ")}
          . {v("corpus.tokens", "int")} Qwen2.5 tokens in{" "}
          {v("corpus.sentences", "int")} sentences. Of their{" "}
          {v("corpus.pool", "int")} questions, {v("corpus.questions", "int")}{" "}
          were picked with a seeded generator (seed{" "}
          {String(man.corpus.sample_seed)}); each keeps its first gold answer
          and that answer&apos;s character offsets. Changes:{" "}
          {man.corpus.changes as string}. Source file SHA-256{" "}
          <code>{man.corpus.sha256 as string}</code>. The derived corpus is
          distributed under the same licence.
        </p>

        <h2>The models (run once, offline)</h2>
        <ul>
          <li>
            Embeddings:{" "}
            <a href={EMBEDDER_URL} className={A}>
              {man.embedder.repo as string}
            </a>{" "}
            at revision{" "}
            <code>{(man.embedder.revision as string).slice(0, 7)}</code> (
            {man.embedder.licence as string}),{" "}
            <code>{man.embedder.file as string}</code> SHA-256{" "}
            <code>{(man.embedder.onnx_sha256 as string).slice(0, 16)}…</code>;{" "}
            {man.embedder.pooling as string}; {String(man.embedder.dim)}{" "}
            dimensions; at most {String(man.embedder.max_tokens)} word pieces.
          </li>
          <li>
            Reranker:{" "}
            <a href={RERANKER_URL} className={A}>
              {man.reranker.repo as string}
            </a>{" "}
            at revision{" "}
            <code>{(man.reranker.revision as string).slice(0, 7)}</code> (
            {man.reranker.licence as string}),{" "}
            <code>{man.reranker.file as string}</code> SHA-256{" "}
            <code>{(man.reranker.onnx_sha256 as string).slice(0, 16)}…</code>;{" "}
            score: {man.reranker.score as string};{" "}
            {v("corpus.rerank_pairs", "int")} pairs.
          </li>
          <li>
            Runtime: ONNX Runtime {man.runtime.onnxruntime as string}, Python{" "}
            {man.runtime.python as string}, {String(man.runtime.threads)} CPU
            threads. Script:{" "}
            <a
              href={`${ENGINE_URL}/blob/main/scripts/build_context_data.py`}
              className={A}
            >
              build_context_data.py
            </a>
            .
          </li>
        </ul>

        <h2>The shipped files</h2>
        <div
          className="focus-ring overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table className="text-xs">
            <tbody>
              {Object.entries(man.files as Record<string, string>).map(
                ([n, h]) => (
                  <tr key={n}>
                    <td className="py-0.5 pr-3 font-mono">{n}</td>
                    <td className="py-0.5 font-mono text-neutral-600 dark:text-neutral-400">
                      {h.slice(0, 24)}…
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        <h2>Retrieval stages (recursive 256-token chunks)</h2>
        <div
          className="focus-ring overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table className="text-sm" data-testid="stages-table">
            <Head />
            <tbody>
              <Row name="BM25" m={ev.bm25.mean} />
              <Row name="Dense, int8" m={dv.int8.mean} />
              <Row name="Dense, int4" m={dv.int4.mean} />
              <Row name="Dense, binary" m={dv.binary.mean} />
              <Row
                name="Dense, float32 (offline run)"
                m={lookup("dense.float32") as Obj}
              />
              <Row name="RRF, k = 60" m={ev.rrf.mean} />
              <Row name="Weighted, α = 0.5" m={ev.weighted.mean} />
              <Row name="RRF, then rerank top 20" m={ev.rerank.mean} />
            </tbody>
          </table>
        </div>

        <h2>Chunkings</h2>
        <div
          className="focus-ring overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table className="text-sm" data-testid="chunkings-table">
            <Head lost />
            <tbody>
              {Object.entries(table).flatMap(([name, row]) =>
                (["bm25", "dense", "rrf"] as const).map((m) => (
                  <Row
                    key={`${name}-${m}`}
                    name={`${name}, ${m}`}
                    m={row[m].mean}
                    lost={row[m].lost as number}
                  />
                )),
              )}
            </tbody>
          </table>
        </div>
        <p>
          A question whose answer a chunking cuts in two (&ldquo;lost&rdquo;)
          scores 0 on every metric. Means are over all{" "}
          {v("corpus.questions", "int")} questions.
        </p>
      </div>
    </main>
  );
}
