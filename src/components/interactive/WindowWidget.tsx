"use client";

/**
 * Chapter 1's hero: a twelve-question research task in a window of B tokens. Each read adds a
 * chunk; past the budget the policy acts (drop the oldest read, compact the old reads into a
 * summary, or search again later). Below the window, the twelve facts: what the agent knows now
 * (filled), what it read and lost (hatched), what it has not reached yet (empty). Frames are the
 * engine's `windowRun` (one per event); changing the budget or the policy shows that run.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { windowCaption } from "@/lib/ctx/captions";
import { fmtInt } from "@/lib/format";
import {
  KIND_COLOUR,
  KIND_NAME,
  MUTED,
  OKABE_ITO,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { Hatch } from "./Hatch";
import { useEngine } from "./useEngine";

const W = 360;
const H = 210;
const BUDGETS = ["1000", "1500", "2000", "3000"] as const;
const POLICIES = ["unbounded", "truncate", "compact", "retrieve"] as const;
type Budget = (typeof BUDGETS)[number];
type Policy = (typeof POLICIES)[number];
const SUMMARISERS = ["perfect", "lossy"] as const;
type Summariser = (typeof SUMMARISERS)[number];

export default function WindowWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("window");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Window data={st.data}>{children}</Window>;
}

function Window({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const [budget, setBudget] = useState<Budget>("1500");
  const [policy, setPolicy] = useState<Policy>("truncate");
  const [summariser, setSummariser] = useState<Summariser>("perfect");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const lossy = policy === "compact" && summariser === "lossy";
  const key = lossy ? `lossy-compact-${budget}` : `${policy}-${budget}`;
  const run = data.runs[key] as Obj;
  const frames = run.frames as Obj[];
  const s = useStepper(frames.length, {
    stepMs: 900,
    resetKey: key,
  });
  const f = frames[s.step]!;
  const task = data.task as Obj[];
  const qids = task.map((q) => q.q as number);
  const items = f.items as Obj[];
  const peak = Math.max(
    ...(Object.values(data.runs) as Obj[]).map((r) => r.peak as number),
  );
  const scaleMax = Math.max(Number(budget), peak) * 1.05;
  const X0 = 8;
  const BW = W - 16;
  const x = (t: number) => X0 + (BW * t) / scaleMax;
  const bx = x(Number(budget));
  let acc = 0;
  const known = new Set(f.known as number[]);
  const learned = new Set(f.learned as number[]);
  const hl =
    f.event === "compact"
      ? "summary"
      : f.event === "truncate"
        ? "budget"
        : f.event === "answer"
          ? "spent"
          : "window";
  const focus = hover ?? hl;

  const visual = (
    <div className="mx-auto max-w-xl">
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`The window: ${f.used} of ${budget} tokens; the agent knows ${known.size} of ${qids.length} facts.`}
      >
        <defs>
          <Hatch id="win-over" />
          <Hatch id="fact-lost" />
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
          const w = Math.max(1, x(acc) - x0);
          const isNew =
            s.step > 0 &&
            it.kind === "read" &&
            it.id === (items[items.length - 1] as Obj).id &&
            f.event !== "answer";
          return (
            <rect
              key={`${it.id}-${x0}`}
              data-item={it.kind}
              data-focus={focus === "window" ? "true" : "false"}
              x={x0}
              y={22}
              width={w}
              height={34}
              fill={KIND_COLOUR[it.kind as string]}
              fillOpacity={
                it.kind === "read" && !(it.facts as number[]).length
                  ? 0.45
                  : 0.9
              }
              stroke={isNew ? STATE_COLOUR.active : "#ffffff"}
              strokeWidth={isNew ? 2 : 0.6}
            />
          );
        })}
        {f.used > Number(budget) && (
          <rect
            x={bx}
            y={22}
            width={Math.max(0, x(f.used as number) - bx)}
            height={34}
            fill="url(#win-over)"
            data-over="true"
          />
        )}
        <line
          data-budget="true"
          data-focus={focus === "budget" ? "true" : "false"}
          x1={bx}
          x2={bx}
          y1={16}
          y2={62}
          stroke={focus === "budget" ? STATE_COLOUR.stalled : "currentColor"}
          strokeWidth={focus === "budget" ? 2.5 : 1.5}
          strokeDasharray="4 2"
          className="text-neutral-700 dark:text-neutral-300"
        />
        <text
          x={bx}
          y={72}
          textAnchor={bx > W - 60 ? "end" : "middle"}
          style={{ fontSize: fs(9) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          budget B = {fmtInt(Number(budget))}
        </text>

        <text
          x={X0}
          y={96}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          What the agent knows ({known.size} of {qids.length} facts)
        </text>
        {qids.map((q, i) => {
          const cx = X0 + 14 + (i % 6) * ((W - 40) / 5);
          const cy = 120 + Math.floor(i / 6) * 38;
          const state = known.has(q)
            ? "known"
            : learned.has(q)
              ? "lost"
              : "unread";
          const isQ = f.q === q;
          return (
            <g key={q} data-fact={state}>
              <circle
                cx={cx}
                cy={cy}
                r={11}
                fill={
                  state === "known"
                    ? OKABE_ITO.green
                    : state === "lost"
                      ? "url(#fact-lost)"
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
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                style={{ fontSize: fs(9) }}
                className="fill-neutral-900 font-medium dark:fill-neutral-100"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        <g
          style={{ fontSize: fs(8.5) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          {(["system", "task", "read", "summary"] as const).map((k, i) => (
            <g
              key={k}
              transform={`translate(${X0 + (i * (W - 16)) / 4}, ${H - 8})`}
            >
              <rect x={0} y={-8} width={9} height={9} fill={KIND_COLOUR[k]} />
              <text x={12} y={0}>
                {font.narrow ? KIND_NAME[k]!.split(" ")[0] : KIND_NAME[k]}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      testId="window-widget"
      title="A long task in a small window"
      summary="Twelve questions over the corpus, a window of B tokens. Each read is one model call that pays for the whole window. Frames from the engine's windowRun."
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
            label="Spent"
            value={fmtInt(f.spent as number)}
            hint="input tokens so far"
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
            label="Policy"
            value={policy}
            options={POLICIES.map((p) => ({ value: p, label: p }))}
            onChange={setPolicy}
          />
          {policy === "compact" && (
            <Segmented
              label="Summariser (lossy is illustrative)"
              value={summariser}
              options={SUMMARISERS.map((x) => ({
                value: x,
                label: x === "lossy" ? "lossy (25% loss)" : x,
              }))}
              onChange={setSummariser}
            />
          )}
        </>
      }
    />
  );
}
