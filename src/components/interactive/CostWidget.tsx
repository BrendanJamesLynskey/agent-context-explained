"use client";

/**
 * Chapter 9's hero: fifty questions over a document set, three ways. Every question adds its cost
 * to each strategy's running total (log scale): the whole set in every prompt, the same with the
 * prompt cache (the first call writes it, later calls read it), and the reranked top k chunks.
 * Beside it, how often the answer is in the prompt (the long prompts by construction; retrieval's
 * measured recall@k). Every number is the engine's `tradeoff` (prices and cache rules from
 * `accounting`, token counts measured on the corpus).
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Choice, Segmented, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { costCaption } from "@/lib/ctx/captions";
import { fmtMs, fmtUsd, pct } from "@/lib/format";
import { MUTED, STATE_COLOUR, STRATEGY_COLOUR } from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { useEngine } from "./useEngine";

const W = 360;
const H = 268;
const KS = ["3", "5", "10", "20"] as const;
const STRATS = ["long", "long+cache", "rag"] as const;
type K = (typeof KS)[number];
const LOG_MIN = -4;
const STRATEGY_SHORT: Record<string, string> = {
  long: "Long prompt",
  "long+cache": "Long, cached",
};
const LOG_MAX = 3;

export default function CostWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("tradeoff");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Cost data={st.data}>{children}</Cost>;
}

function sizeLabel(n: number): string {
  return n >= 1_000_000
    ? `${n / 1_000_000}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : String(n);
}

function Cost({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const models = Object.keys(data.prices as Obj);
  const sizes = [
    ...new Set(
      Object.values(data.runs as Obj).map((r) => (r as Obj).n_ctx as number),
    ),
  ].sort((a, b) => a - b);
  const [model, setModel] = useState(models[0]!);
  const [size, setSize] = useState(String(sizes[sizes.length - 1]));
  const [k, setK] = useState<K>("5");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const key = `${model}|${size}|${k}`;
  const run = data.runs[key] as Obj;
  const n = run.questions as number;
  const s = useStepper(n, { stepMs: 220, resetKey: key });
  const i = s.step;
  const st = run.strategies as Record<string, Obj>;
  const recall = data.recall[k] as number;

  const hl =
    i === 0
      ? "write"
      : (st["long+cache"]!.cached[i] as number)
        ? "cache"
        : "long";
  const focus = hover ?? hl;

  const cx0 = 60;
  const cx1 = W - 96;
  const cy0 = 214;
  const cy1 = 24;
  const x = (q: number) => cx0 + ((cx1 - cx0) * q) / (n - 1);
  const y = (usd: number) =>
    cy0 -
    ((cy0 - cy1) * (Math.log10(Math.max(usd, 10 ** LOG_MIN)) - LOG_MIN)) /
      (LOG_MAX - LOG_MIN);
  const bx0 = W - 80;

  const visual = (
    <div className="mx-auto max-w-xl">
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`After ${i + 1} questions: long prompt ${fmtUsd(st.long!.cum[i] as number)}, cached ${fmtUsd(st["long+cache"]!.cum[i] as number)}, retrieval ${fmtUsd(st.rag!.cum[i] as number)}.`}
      >
        <text
          x={8}
          y={14}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          Total cost so far (US$, log scale)
        </text>
        <line x1={cx0} x2={cx1} y1={cy0} y2={cy0} stroke={MUTED.light} />
        <line x1={cx0} x2={cx0} y1={cy1} y2={cy0} stroke={MUTED.light} />
        {[-4, -2, 0, 2].map((e) => (
          <g key={e}>
            <line
              x1={cx0}
              x2={cx1}
              y1={y(10 ** e)}
              y2={y(10 ** e)}
              stroke={MUTED.light}
              strokeOpacity={0.35}
            />
            <text
              x={cx0 - 4}
              y={y(10 ** e) + 4}
              textAnchor="end"
              style={{ fontSize: fs(8.5) }}
              className="fill-neutral-600 dark:fill-neutral-400"
            >
              {e === 0
                ? "$1"
                : e > 0
                  ? `$${10 ** e}`
                  : `$${(10 ** e).toFixed(-e)}`}
            </text>
          </g>
        ))}
        {[1, 25, 50].map((q) => (
          <text
            key={q}
            x={x(q - 1)}
            y={cy0 + 13}
            textAnchor="middle"
            style={{ fontSize: fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {q}
          </text>
        ))}
        <text
          x={(cx0 + cx1) / 2}
          y={cy0 + 28}
          textAnchor="middle"
          style={{ fontSize: fs(9) }}
          className="fill-neutral-600 dark:fill-neutral-400"
        >
          questions asked
        </text>
        {STRATS.map((sname) => {
          const cum = st[sname]!.cum as number[];
          const on =
            (focus === "long" && sname === "long") ||
            ((focus === "cache" || focus === "write") &&
              sname === "long+cache") ||
            (focus === "rag" && sname === "rag");
          return (
            <g key={sname} data-strategy={sname}>
              <polyline
                points={cum
                  .slice(0, i + 1)
                  .map((c, q) => `${x(q)},${y(c)}`)
                  .join(" ")}
                fill="none"
                stroke={STRATEGY_COLOUR[sname]}
                strokeWidth={on ? 3 : 2}
              />
              <circle
                cx={x(i)}
                cy={y(cum[i]!)}
                r={on ? 5 : 3.5}
                fill={STRATEGY_COLOUR[sname]}
                stroke={on ? STATE_COLOUR.active : "none"}
                strokeWidth={2}
              />
            </g>
          );
        })}
        <text
          x={bx0}
          y={14}
          style={{ fontSize: fs(9) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          {font.narrow ? "Answer in" : "Answer in prompt"}
        </text>
        {STRATS.map((sname, j) => {
          const v = sname === "rag" ? recall : 1;
          const bh = 150 * v;
          const bxx = bx0 + j * 25;
          return (
            <g key={sname} data-answer={sname}>
              <rect
                x={bxx}
                y={cy0 - bh}
                width={18}
                height={bh}
                fill={STRATEGY_COLOUR[sname]}
                fillOpacity={0.85}
              />
              <text
                x={bxx + 9}
                y={cy0 - bh - 4}
                textAnchor="middle"
                style={{ fontSize: fs(8) }}
                className="fill-neutral-800 dark:fill-neutral-200"
              >
                {sname === "rag" ? recall.toFixed(3) : "1"}
              </text>
            </g>
          );
        })}
        <g style={{ fontSize: fs(8.5) }}>
          {STRATS.map((sname, j) => (
            <g
              key={sname}
              transform={`translate(${8 + (j * (W - 16)) / 3}, ${H - 4})`}
            >
              <rect
                x={0}
                y={-8}
                width={9}
                height={9}
                fill={STRATEGY_COLOUR[sname]}
              />
              <text
                x={12}
                y={0}
                className="fill-neutral-700 dark:fill-neutral-300"
              >
                {sname === "rag" ? `Top-${k} retrieval` : STRATEGY_SHORT[sname]}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      testId="cost-widget"
      title="Long context or retrieval?"
      summary="Fifty questions over a document set: the whole set in every prompt, the same with the prompt cache, or the reranked top k chunks. Dated list prices (illustrative); frames from the engine's tradeoff."
      stepper={s}
      stepLabel="question"
      countFrom={1}
      caption={costCaption(run, i, fmtUsd)}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Long prompt"
            value={fmtUsd(st.long!.cum[n - 1] as number)}
            hint={`${n} questions; first token in ${fmtMs(st.long!.ttft[0] as number)}`}
          />
          <Stat
            label="Cached"
            value={fmtUsd(st["long+cache"]!.cum[n - 1] as number)}
            hint={`later first token in ${fmtMs(st["long+cache"]!.ttft[1] as number)}`}
          />
          <Stat
            label={`Top-${k} retrieval`}
            value={fmtUsd(st.rag!.cum[n - 1] as number)}
            hint={`first token in ${fmtMs(st.rag!.ttft[0] as number)}`}
          />
          <Stat
            label="Answer in prompt"
            value={pct(recall, 1)}
            hint={`retrieval, measured recall@${k}`}
          />
        </div>
      }
      params={
        <>
          <Choice
            label="Model (list price)"
            value={model}
            options={models.map((m) => ({
              value: m,
              label: (data.prices[m] as Obj).label as string,
            }))}
            onChange={setModel}
          />
          <Segmented
            label="Document set (tokens)"
            value={size}
            options={sizes.map((z) => ({
              value: String(z),
              label: z === sizes[0] ? `${sizeLabel(z)} (corpus)` : sizeLabel(z),
            }))}
            onChange={setSize}
          />
          <Segmented
            label="Chunks retrieved, k"
            value={k}
            options={KS.map((x) => ({ value: x, label: x }))}
            onChange={setK}
          />
        </>
      }
    />
  );
}
