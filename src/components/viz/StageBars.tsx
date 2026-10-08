/**
 * The landing page's figure: recall@1 and recall@5 of each retrieval stage over the 200
 * questions, computed by the engine at build time. Server Component, no client JavaScript.
 */
import { lookup } from "@/lib/ctx/values";
import { STAGE_COLOUR, STAGE_NAME } from "@/lib/viz/palette";

const STAGES = ["bm25", "dense", "rrf", "rerank"] as const;

export function StageBars(): JSX.Element {
  const W = 320;
  const H = 168;
  const v = (s: string, k: number) =>
    lookup(`hybrid.evals.${s}.mean.recall@${k}`) as number;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Recall at 1 and at 5 for BM25, dense, RRF and reranked retrieval"
    >
      {STAGES.map((s, i) => {
        const y = 8 + i * 40;
        const r1 = v(s, 1);
        const r5 = v(s, 5);
        return (
          <g key={s} data-stage={s}>
            <text
              x={0}
              y={y + 12}
              fontSize={12}
              className="fill-neutral-700 dark:fill-neutral-300"
            >
              {s === "rerank" ? "RRF + rerank" : STAGE_NAME[s]}
            </text>
            <rect
              x={96}
              y={y}
              width={(W - 150) * r5}
              height={14}
              fill={STAGE_COLOUR[s]}
              fillOpacity={0.45}
            />
            <rect
              x={96}
              y={y + 16}
              width={(W - 150) * r1}
              height={14}
              fill={STAGE_COLOUR[s]}
            />
            <text
              x={100 + (W - 150) * r5}
              y={y + 11}
              fontSize={11}
              className="fill-neutral-900 dark:fill-neutral-100"
            >
              {r5.toFixed(3)} @5
            </text>
            <text
              x={100 + (W - 150) * r1}
              y={y + 27}
              fontSize={11}
              className="fill-neutral-900 dark:fill-neutral-100"
            >
              {r1.toFixed(3)} @1
            </text>
          </g>
        );
      })}
    </svg>
  );
}
