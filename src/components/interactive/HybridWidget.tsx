"use client";

/**
 * Chapter 4: hybrid retrieval and reranking. Two ranked lists (BM25 and dense) merge rank by rank
 * under reciprocal rank fusion: at rank r each list adds 1/(k + r) to its chunk, and the fused top
 * ten re-sorts. Then the recorded cross-encoder reads the question with each of the fused top n and
 * reorders them. Frames are the engine's `hybridFrames`; the bars are each stage's recall over all
 * 200 questions.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Choice, Segmented } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { hybridCaption } from "@/lib/ctx/captions";
import { clip } from "@/lib/format";
import {
  ARTICLE_COLOUR,
  RELEVANT,
  STAGE_COLOUR,
  STAGE_NAME,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { useEngine } from "./useEngine";

const STAGES = ["bm25", "dense", "rrf", "weighted", "rerank"] as const;
const KS = ["1", "3", "5", "10"] as const;

export default function HybridWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("hybrid");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Hybrid data={st.data}>{children}</Hybrid>;
}

function Chip({
  c,
  chunks,
  rel,
  active,
}: {
  c: number;
  chunks: Record<string, Obj>;
  rel: Set<number>;
  active: boolean;
}) {
  const ch = chunks[c]!;
  return (
    <span
      data-chunk={c}
      data-relevant={rel.has(c) ? "true" : "false"}
      title={`chunk ${c} (${ch.title as string}): ${clip(ch.text as string, 140)}`}
      className="inline-flex h-6 min-w-0 items-center gap-1 rounded px-1 font-mono text-[0.7rem] text-neutral-900 dark:text-neutral-100"
      style={{
        background: `${ARTICLE_COLOUR[ch.article as number]}55`,
        outline: rel.has(c)
          ? `2.5px solid ${RELEVANT}`
          : active
            ? `2px solid ${STATE_COLOUR.active}`
            : "none",
      }}
    >
      {rel.has(c) ? "✓" : ""}
      {c}
    </span>
  );
}

function Hybrid({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const qs = data.questions as Obj[];
  const [qi, setQi] = useState(String(qs[0]!.q));
  const [k, setK] = useState<(typeof KS)[number]>("5");
  const [hover, setHover] = useState<string | null>(null);
  const h = data.hybrid[qi] as Obj;
  const frames = h.frames as Obj[];
  const s = useStepper(frames.length, { stepMs: 1000, resetKey: `${qi}|${k}` });
  const f = frames[s.step]!;
  const chunks = data.chunks as Record<string, Obj>;
  const rel = new Set(h.relevant as number[]);
  const pos = f.stage === "fuse" ? (f.rank as number) - 1 : 10;
  const adds = new Set(f.adds as number[]);
  const q = qs.find((x) => String(x.q) === qi)!;
  const bfont = useSvgFont(360);
  const fs = bfont.fs;
  const hl = f.stage === "rerank" ? "ce" : "rank";
  const focus = hover ?? hl;
  const maxScore = Math.max(
    ...(f.top as Obj[]).map((t) => t.score as number),
    1e-9,
  );

  const column = (key: string, list: number[]) => (
    <div className="min-w-0" data-list={key}>
      <p
        className="mb-1 border-l-4 pl-1 text-[0.7rem] font-medium uppercase tracking-widest text-neutral-700 dark:text-neutral-300"
        style={{ borderColor: STAGE_COLOUR[key] }}
      >
        {STAGE_NAME[key]}
      </p>
      <ol className="space-y-1">
        {list.map((c, i) => (
          <li
            key={c}
            className={`flex items-center gap-1 border-l-4 pl-1 ${f.stage !== "fuse" || i <= pos ? "border-indigo-500" : "border-transparent"}`}
            data-reached={f.stage !== "fuse" || i <= pos ? "true" : "false"}
          >
            <span className="w-5 shrink-0 text-right font-mono text-[0.65rem] text-neutral-600 dark:text-neutral-400">
              {i + 1}
            </span>
            <Chip
              c={c}
              chunks={chunks}
              rel={rel}
              active={f.stage === "fuse" && i === pos}
            />
          </li>
        ))}
      </ol>
    </div>
  );

  const ev = data.evals as Record<string, Obj>;
  const W = 360;
  const BH = 130;
  const bars = (
    <svg
      ref={bfont.ref}
      viewBox={`0 0 ${W} ${BH}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Recall at ${k} for each stage over all questions`}
    >
      {STAGES.map((st, i) => {
        const v = ev[st]!.mean[`recall@${k}`] as number;
        const y = 6 + i * 24;
        const w = (W - 150) * v;
        return (
          <g key={st} data-stage={st}>
            <text
              x={4}
              y={y + 14}
              style={{ fontSize: fs(9.5) }}
              className="fill-neutral-700 dark:fill-neutral-300"
            >
              {st === "weighted"
                ? "Weighted α=0.5"
                : st === "rerank"
                  ? "RRF + rerank"
                  : STAGE_NAME[st]}
            </text>
            <rect x={110} y={y} width={w} height={18} fill={STAGE_COLOUR[st]} />
            <text
              x={114 + w}
              y={y + 14}
              style={{ fontSize: fs(9.5) }}
              className="fill-neutral-900 dark:fill-neutral-100"
            >
              {v.toFixed(3)}
            </text>
          </g>
        );
      })}
    </svg>
  );

  const visual = (
    <div className="min-w-0">
      <p className="mb-2 break-words text-sm text-neutral-800 dark:text-neutral-200">
        Question {q.q as number}:{" "}
        <span className="font-medium">{q.question as string}</span>{" "}
        <span className="text-neutral-600 dark:text-neutral-400">
          (answer: {q.answer as string})
        </span>
      </p>
      <div className="grid min-w-0 grid-cols-3 gap-2">
        {column("bm25", h.bm25 as number[])}
        <div className="min-w-0" data-list="fused">
          <p
            className="mb-1 border-l-4 pl-1 text-[0.7rem] font-medium uppercase tracking-widest text-neutral-700 dark:text-neutral-300"
            style={{
              borderColor:
                STAGE_COLOUR[f.stage === "rerank" ? "rerank" : "rrf"],
            }}
          >
            {f.stage === "rerank" ? "Reranked" : "Fused (RRF)"}
          </p>
          <ol className="space-y-1">
            {(f.top as Obj[]).map((t, i) => (
              <li key={t.chunk as number} className="flex items-center gap-1">
                <span className="w-5 shrink-0 text-right font-mono text-[0.65rem] text-neutral-600 dark:text-neutral-400">
                  {i + 1}
                </span>
                <Chip
                  c={t.chunk as number}
                  chunks={chunks}
                  rel={rel}
                  active={adds.has(t.chunk as number)}
                />
                <span
                  className="h-2 rounded"
                  style={{
                    width: `${Math.max(4, (40 * (t.score as number)) / maxScore)}%`,
                    background:
                      STAGE_COLOUR[f.stage === "rerank" ? "rerank" : "rrf"],
                  }}
                />
              </li>
            ))}
          </ol>
        </div>
        {column("dense", h.dense as number[])}
      </div>
      <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        Rank of the answer&apos;s chunk: BM25 {h.first.bm25 as number}, dense{" "}
        {h.first.dense as number}, RRF {h.first.rrf as number}, after the rerank{" "}
        {h.first.rerank as number}.
      </p>
      <div className="mt-3">{bars}</div>
    </div>
  );

  return (
    <AnimationPanel
      testId="hybrid-widget"
      title="Two lists, one ranking, then a rerank"
      summary="Chips are chunks (coloured by article, ✓ holds the answer). Each frame adds one rank of both lists to the fused scores; the last frame is the cross-encoder's order. Frames from the engine's hybridFrames; bars are recall over all 200 questions."
      stepper={s}
      stepLabel="step"
      caption={hybridCaption(f)}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      params={
        <>
          <Choice
            label="Question"
            value={qi}
            options={qs.map((x) => ({
              value: String(x.q),
              label: clip(x.question as string, 60),
            }))}
            onChange={setQi}
          />
          <Segmented
            label="Recall at k (bars)"
            value={k}
            options={KS.map((x) => ({ value: x, label: `k=${x}` }))}
            onChange={setK}
          />
        </>
      }
    />
  );
}
