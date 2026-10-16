/**
 * This site's favicon glyph (src/app/icon.svg) and its card's graphic.
 * Glyph: the bubble of the Agents track, the letter C, #16a34a.
 */
import { lookup } from "@/lib/ctx/values";
import { STAGE_COLOUR } from "@/lib/viz/palette";

export function Glyph({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="0.5" y="1" width="31" height="24" rx="6" fill="#16a34a" />
      <path d="M6 23v8.5l8.5-8.5z" fill="#16a34a" />
      <path
        d="M17.24 8.27Q15.53 8.27 14.63 9.55Q13.73 10.82 13.73 13.04Q13.73 15.27 14.56 16.5Q15.39 17.73 17.24 17.73Q18.1 17.73 18.95 17.53Q19.8 17.33 20.8 16.98V19.47Q19.88 19.84 18.98 20.02Q18.08 20.2 16.96 20.2Q14.8 20.2 13.4 19.3Q12 18.41 11.33 16.79Q10.67 15.18 10.67 13.02Q10.67 10.9 11.43 9.27Q12.2 7.65 13.66 6.73Q15.12 5.8 17.24 5.8Q18.27 5.8 19.32 6.07Q20.37 6.33 21.33 6.78L20.37 9.2Q19.59 8.82 18.79 8.55Q18 8.27 17.24 8.27Z"
        fill="#fff"
      />
    </svg>
  );
}

/**
 * The landing hero's bars: recall at 5 (pale) and at 1 (solid) for BM25, dense, RRF and
 * RRF + rerank over the corpus's questions, from the engine at build time.
 */
const STAGES = ["bm25", "dense", "rrf", "rerank"] as const;

export function Motif(): JSX.Element {
  const v = (s: string, k: number) =>
    lookup(`hybrid.evals.${s}.mean.recall@${k}`) as number;
  return (
    <svg width="440" height="420" viewBox="0 0 440 420">
      <line x1={20} y1={20} x2={20} y2={400} stroke="#475569" strokeWidth={3} />
      {STAGES.map((s, i) => {
        const y = 36 + i * 92;
        const c = STAGE_COLOUR[s] ?? "#64748b";
        return (
          <g key={s}>
            <rect
              x={20}
              y={y}
              width={400 * v(s, 5)}
              height={64}
              rx={6}
              fill={c}
              fillOpacity={0.35}
            />
            <rect
              x={20}
              y={y}
              width={400 * v(s, 1)}
              height={64}
              rx={6}
              fill={c}
            />
          </g>
        );
      })}
    </svg>
  );
}
