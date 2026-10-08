"use client";

/**
 * Chapter 7's hero: the long task (36 questions) under a budget, compacted by a perfect or a lossy
 * summariser. The window fills and is compacted; the 36 facts are known (filled), lost (hatched:
 * dropped by the summariser or trimmed with the summary) or not reached yet. Beside it, the
 * survival curve measured over 20 seeded runs against the model (1 - loss)^n. Frames are the
 * engine's `windowRun` with `summariser: "lossy"`; the curve is its `compactionStudy`.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { windowCaption } from "@/lib/ctx/captions";
import { fmtInt } from "@/lib/format";
import { KIND_COLOUR, MUTED, OKABE_ITO, STATE_COLOUR } from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { Hatch } from "./Hatch";
import { useEngine } from "./useEngine";

const W = 360;
const H = 300;
const BUDGETS = ["1500", "2000"] as const;
const LOSSES = ["0", "0.1", "0.25", "0.5"] as const;
const POLICIES = ["compact", "compact+retrieve"] as const;
type Budget = (typeof BUDGETS)[number];
type Loss = (typeof LOSSES)[number];
type Policy = (typeof POLICIES)[number];
const NMAX = 10;

export default function CompactionWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("compaction");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Compaction data={st.data}>{children}</Compaction>;
}

function Compaction({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const [budget, setBudget] = useState<Budget>("1500");
  const [loss, setLoss] = useState<Loss>("0.25");
  const [policy, setPolicy] = useState<Policy>("compact");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const key = `${policy}-${loss}-${budget}`;
  const run = data.runs[key] as Obj;
  const frames = run.frames as Obj[];
  const s = useStepper(frames.length, { stepMs: 260, resetKey: key });
  const f = frames[s.step]!;
  const task = data.task as Obj[];
  const qids = task.map((q) => q.q as number);
  const items = f.items as Obj[];
  const known = new Set(f.known as number[]);
  const learned = new Set(f.learned as number[]);
  const study =
    loss === "0" ? null : (data.studies[`compact-${loss}-${budget}`] as Obj);
  let compactions = 0;
  for (const x of frames.slice(0, s.step + 1))
    if (x.event === "compact") compactions += 1;

  const hl =
    f.event === "compact"
      ? loss === "0"
        ? "summary"
        : "loss"
      : f.event === "truncate"
        ? "budget"
        : "summary";
  const focus = hover ?? hl;

  const X0 = 8;
  const peak = Math.max(
    ...(Object.values(data.runs) as Obj[]).map((r) => r.peak as number),
  );
  const scaleMax = Math.max(Number(budget), peak) * 1.05;
  const x = (t: number) => X0 + ((W - 16) * t) / scaleMax;
  const bx = x(Number(budget));
  let acc = 0;

  // survival chart
  const cx0 = 40;
  const cx1 = W - 12;
  const cy0 = 284;
  const cy1 = 186;
  const sx = (n: number) => cx0 + ((cx1 - cx0) * n) / NMAX;
  const sy = (v: number) => cy0 - (cy0 - cy1) * v;
  const surv = (study?.survival as Obj[] | undefined)?.slice(0, NMAX) ?? [];
  const l = Number(loss);
  const model = Array.from({ length: NMAX + 1 }, (_, n) => {
    let t = 1;
    for (let i = 0; i < n; i++) t *= 1 - l;
    return [n, t] as const;
  });

  const visual = (
    <div className="mx-auto max-w-xl">
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`The long task: ${f.used} of ${budget} tokens in the window; the agent knows ${known.size} of ${qids.length} facts.`}
      >
        <defs>
          <Hatch id="cmp-lost" />
        </defs>
        <text
          x={X0}
          y={14}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          The window ({fmtInt(f.used as number)} tokens)
        </text>
        {items.map((it) => {
          const x0 = x(acc);
          acc += it.tokens as number;
          return (
            <rect
              key={`${it.id}-${x0}`}
              data-item={it.kind}
              x={x0}
              y={22}
              width={Math.max(1, x(acc) - x0)}
              height={28}
              fill={KIND_COLOUR[it.kind as string]}
              fillOpacity={
                it.kind === "read" && !(it.facts as number[]).length
                  ? 0.45
                  : 0.9
              }
              stroke={
                it.kind === "summary" && focus !== "budget"
                  ? STATE_COLOUR.active
                  : "#ffffff"
              }
              strokeWidth={it.kind === "summary" ? 1.5 : 0.6}
            />
          );
        })}
        <line
          data-budget="true"
          x1={bx}
          x2={bx}
          y1={16}
          y2={56}
          stroke={focus === "budget" ? STATE_COLOUR.stalled : "currentColor"}
          strokeWidth={focus === "budget" ? 2.5 : 1.5}
          strokeDasharray="4 2"
          className="text-neutral-700 dark:text-neutral-300"
        />
        <text
          x={X0}
          y={74}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          What the agent knows ({known.size} of {qids.length} facts)
        </text>
        {qids.map((q, i) => {
          const cx = X0 + 12 + (i % 12) * ((W - 40) / 11);
          const cy = 92 + Math.floor(i / 12) * 26;
          const state = known.has(q)
            ? "known"
            : learned.has(q)
              ? "lost"
              : "unread";
          const isQ = f.q === q;
          return (
            <circle
              key={q}
              data-fact={state}
              cx={cx}
              cy={cy}
              r={9}
              fill={
                state === "known"
                  ? OKABE_ITO.green
                  : state === "lost"
                    ? "url(#cmp-lost)"
                    : "none"
              }
              stroke={
                isQ
                  ? STATE_COLOUR.active
                  : state === "lost"
                    ? STATE_COLOUR.stalled
                    : MUTED.light
              }
              strokeWidth={isQ ? 3 : 1.5}
            />
          );
        })}

        <text
          x={X0}
          y={176}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          {study
            ? `Facts left after n compactions (20 runs, compact @${budget})`
            : "Perfect summariser: every fact survives every compaction"}
        </text>
        <line x1={cx0} x2={cx1} y1={cy0} y2={cy0} stroke={MUTED.light} />
        <line x1={cx0} x2={cx0} y1={cy1} y2={cy0} stroke={MUTED.light} />
        {[0, 0.5, 1].map((v) => (
          <text
            key={v}
            x={cx0 - 4}
            y={sy(v) + 4}
            textAnchor="end"
            style={{ fontSize: fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {v}
          </text>
        ))}
        {[0, 5, 10].map((n) => (
          <text
            key={n}
            x={sx(n)}
            y={cy0 + 12 > H ? H : cy0 + 12}
            textAnchor="middle"
            style={{ fontSize: fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {n}
          </text>
        ))}
        <polyline
          data-model="true"
          points={model.map(([n, t]) => `${sx(n)},${sy(t)}`).join(" ")}
          fill="none"
          stroke={focus === "loss" ? STATE_COLOUR.active : OKABE_ITO.purple}
          strokeWidth={focus === "loss" ? 2.5 : 1.5}
          strokeDasharray="5 3"
        />
        {surv.length > 0 && (
          <polyline
            data-measured="true"
            points={[`${sx(0)},${sy(1)}`]
              .concat(
                surv.map(
                  (p) => `${sx(p.n as number)},${sy(p.measured as number)}`,
                ),
              )
              .join(" ")}
            fill="none"
            stroke={OKABE_ITO.green}
            strokeWidth={2}
          />
        )}
        {surv.map((p) => (
          <circle
            key={p.n as number}
            cx={sx(p.n as number)}
            cy={sy(p.measured as number)}
            r={2.5}
            fill={OKABE_ITO.green}
          />
        ))}
        <g style={{ fontSize: fs(8.5) }} opacity={study ? 1 : 0}>
          <text x={cx1} y={cy1 + 10} textAnchor="end" fill={OKABE_ITO.green}>
            measured
          </text>
          <text
            x={cx1}
            y={cy1 + 26}
            textAnchor="end"
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            (1 − loss)ⁿ, dashed
          </text>
        </g>
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      testId="compaction-widget"
      title="What survives compaction"
      summary="The long task, 36 questions, compacted by a perfect or a lossy summariser. Frames from the engine's windowRun; the curve from its compactionStudy over 20 seeded runs."
      stepper={s}
      stepLabel="event"
      countFrom={0}
      caption={windowCaption(f)}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Window"
            value={`${fmtInt(f.used as number)} / ${fmtInt(Number(budget))}`}
            hint="tokens"
          />
          <Stat
            label="Knows"
            value={`${known.size} of ${qids.length}`}
            hint="facts in the window"
          />
          <Stat
            label="Compactions"
            value={`${compactions} of ${run.compactions as number}`}
            hint="so far, of this run"
          />
          <Stat
            label="At the end"
            value={`${run.recalled as number} of ${qids.length}`}
            hint={`answered, for ${fmtInt(run.spent as number)} tokens`}
          />
        </div>
      }
      params={
        <>
          <Segmented
            label="Budget B (tokens)"
            value={budget}
            options={BUDGETS.map((b) => ({ value: b, label: b }))}
            onChange={setBudget}
          />
          <Segmented
            label="Summariser loss (illustrative)"
            value={loss}
            options={LOSSES.map((x) => ({
              value: x,
              label: x === "0" ? "perfect" : x,
            }))}
            onChange={setLoss}
          />
          <Segmented
            label="Policy"
            value={policy}
            options={POLICIES.map((p) => ({ value: p, label: p }))}
            onChange={setPolicy}
          />
        </>
      }
    />
  );
}
