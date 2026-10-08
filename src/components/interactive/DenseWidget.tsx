"use client";

/**
 * Chapter 3: dense retrieval. Every chunk of the default chunking as a point (its 384-dimensional
 * int8 embedding projected onto two principal axes, computed offline); the query moves from
 * question to question and its k nearest chunks (by cosine in all 384 dimensions, recomputed by
 * the engine) light up, the one that holds the answer ticked. Switch the precision to see the
 * neighbours an int4 or a one-bit vector finds.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { clip } from "@/lib/format";
import { ARTICLE_COLOUR, RELEVANT, STATE_COLOUR } from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { useEngine } from "./useEngine";

const W = 360;
const H = 260;
const PRECISIONS = ["int8", "int4", "binary"] as const;
type P = (typeof PRECISIONS)[number];

export default function DenseWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("dense");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Dense data={st.data}>{children}</Dense>;
}

function Dense({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const [prec, setPrec] = useState<P>("int8");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const frames = data.frames[prec] as Obj[];
  const s = useStepper(frames.length, { stepMs: 1600, resetKey: prec });
  const f = frames[s.step]!;
  const pca = data.pca as Obj;
  const pts = pca.chunks as number[][];
  const xs = pts
    .map((p) => p[0]!)
    .concat((pca.questions as number[][]).map((p) => p[0]!));
  const ys = pts
    .map((p) => p[1]!)
    .concat((pca.questions as number[][]).map((p) => p[1]!));
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const px = (v: number) => 12 + ((W - 24) * (v - x0)) / (x1 - x0);
  const py = (v: number) => H - 30 - ((H - 44) * (v - y0)) / (y1 - y0);
  const qp = (pca.questions as number[][])[s.step]!;
  const nb = f.neighbours as Obj[];
  const nbSet = new Set(nb.map((n) => n.chunk as number));
  const rel = new Set(f.relevant as number[]);
  const q = (data.questions as Obj[])[s.step]!;
  const arts = pca.articles as number[];
  const titles = [
    ...new Set(
      Object.values(data.chunks as Record<string, Obj>).map(
        (c) => `${c.article}|${c.title}`,
      ),
    ),
  ];
  const hl = "dot";
  const focus = hover ?? hl;
  const ev = data.evals as Record<string, Obj>;

  const visual = (
    <div className="mx-auto min-w-0 max-w-xl">
      <p
        className="mb-2 break-words text-sm text-neutral-800 dark:text-neutral-200"
        data-testid="dense-query"
      >
        Question {q.q as number} ({q.title as string}):{" "}
        <span className="font-medium">{q.question as string}</span>
      </p>
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Chunks as points; the query and its ${nb.length} nearest chunks.`}
      >
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={px(p[0]!)}
            cy={py(p[1]!)}
            r={nbSet.has(i) ? 4.5 : 2.4}
            fill={ARTICLE_COLOUR[arts[i]!]}
            fillOpacity={nbSet.has(i) ? 1 : 0.45}
            stroke={
              rel.has(i)
                ? RELEVANT
                : nbSet.has(i)
                  ? STATE_COLOUR.active
                  : "none"
            }
            strokeWidth={rel.has(i) ? 2.5 : 1.5}
            data-neighbour={nbSet.has(i) ? "true" : undefined}
          />
        ))}
        {nb.map((n) => {
          const p = pts[n.chunk as number]!;
          return (
            <line
              key={n.chunk as number}
              x1={px(qp[0]!)}
              y1={py(qp[1]!)}
              x2={px(p[0]!)}
              y2={py(p[1]!)}
              stroke={n.relevant ? RELEVANT : STATE_COLOUR.active}
              strokeWidth={n.relevant ? 2 : 1}
              strokeOpacity={0.8}
            />
          );
        })}
        <g
          data-query="true"
          transform={`translate(${px(qp[0]!)}, ${py(qp[1]!)})`}
        >
          <path
            d="M0,-8 L2.4,-2.5 L8,-2.5 L3.5,1 L5,7 L0,3.6 L-5,7 L-3.5,1 L-8,-2.5 L-2.4,-2.5 Z"
            className="fill-neutral-900 dark:fill-neutral-100"
          />
        </g>
        <g
          style={{ fontSize: fs(8) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          {titles
            .map((t) => t.split("|"))
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([a, t], i) => (
              <g
                key={a}
                transform={`translate(${8 + (i % 3) * ((W - 16) / 3)}, ${H - 18 + Math.floor(i / 3) * 11})`}
              >
                <circle cx={3} cy={-3} r={3} fill={ARTICLE_COLOUR[Number(a)]} />
                <text x={9} y={0}>
                  {clip(t!, font.narrow ? 14 : 22)}
                </text>
              </g>
            ))}
        </g>
      </svg>
      <ol
        className="mt-2 space-y-1 text-xs text-neutral-700 dark:text-neutral-300"
        data-testid="neighbours"
      >
        {nb.map((n, i) => (
          <li key={n.chunk as number} className="break-words">
            <span className="font-mono">
              {i + 1}. {n.relevant ? "✓ " : ""}chunk {n.chunk as number} · cos{" "}
              {(n.sim as number).toFixed(3)}
            </span>{" "}
            — {clip((data.chunks[n.chunk as number] as Obj).text as string, 90)}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <AnimationPanel
      testId="dense-widget"
      title="Nearest neighbours of a question"
      summary={`Points are chunks (PCA of their ${data.model as string} embeddings, offline, ${Math.round(
        100 *
          ((pca.explained as number[])[0]! + (pca.explained as number[])[1]!),
      )}% of the variance); the star is the question. Neighbours by cosine over all 384 dimensions, from the engine's denseFrames.`}
      stepper={s}
      stepLabel="question"
      caption={f.caption as string}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRECISIONS.map((p) => (
            <Stat
              key={p}
              label={`${p} recall@5`}
              value={(ev[p]!.mean["recall@5"] as number).toFixed(3)}
              hint={`${data.bytes[p] as number} bytes a vector`}
              plain
            />
          ))}
          <Stat
            label="float32 recall@5"
            value={(data.float32["recall@5"] as number).toFixed(3)}
            hint="1,536 bytes; offline run"
            plain
          />
        </div>
      }
      params={
        <Segmented
          label="Precision"
          value={prec}
          options={PRECISIONS.map((p) => ({ value: p, label: p }))}
          onChange={setPrec}
        />
      }
    />
  );
}
