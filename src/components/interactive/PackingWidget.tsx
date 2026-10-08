"use client";

/**
 * Chapter 6's hero: packing a token budget. The twenty reranked candidates (rank, value, tokens;
 * a tick on the one that holds the answer) are considered one by one: the greedy packers take what
 * still fits in their order (rank, or value per token); the dynamic programme shows, row by row,
 * the best value reachable within the budget. Below, the window fills, and then the packed set is
 * laid out in the chosen placement under the illustrative position curve, with the answer's p.
 * Frames are the engine's `packingView` steps; placements are the engine's `place`/`useP`.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Choice, Segmented, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { packingCaption } from "@/lib/ctx/captions";
import { clip, fmtInt, pct } from "@/lib/format";
import {
  KIND_COLOUR,
  MUTED,
  OKABE_ITO,
  RELEVANT,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { Hatch } from "./Hatch";
import { useEngine } from "./useEngine";

const W = 360;
const H = 262;
const BUDGETS = ["256", "512", "1024"] as const;
const PACKERS = ["top", "density", "optimal"] as const;
const PLACEMENTS = ["best-first", "best-last", "ends", "middle"] as const;
type Budget = (typeof BUDGETS)[number];
type Packer = (typeof PACKERS)[number];
type Placement = (typeof PLACEMENTS)[number];

export default function PackingWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("packing");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Packing data={st.data}>{children}</Packing>;
}

function Packing({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const qs = data.questions as Obj[];
  const [q, setQ] = useState(String(qs[0]!.q));
  const [budget, setBudget] = useState<Budget>("512");
  const [packer, setPacker] = useState<Packer>("top");
  const [placement, setPlacement] = useState<Placement>("ends");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const view = data.views[`${q}-${budget}`] as Obj;
  const cands = view.candidates as Obj[];
  const pk = view.packers[packer] as Obj;
  const steps = pk.steps as Obj[];
  const s = useStepper(steps.length + 1, {
    stepMs: 650,
    resetKey: `${q}-${budget}-${packer}-${placement}`,
  });
  const B = Number(budget);
  const done = s.step === steps.length;
  // state after `s.step` steps
  const seen = new Set<number>();
  const taken: number[] = [];
  for (const x of steps.slice(0, s.step)) {
    seen.add(x.i as number);
    if (packer !== "optimal" && x.take) taken.push(x.i as number);
  }
  const finalSet = new Set(pk.chosen as number[]);
  const inWindow =
    packer === "optimal" ? (done ? (pk.chosen as number[]) : []) : taken;
  const cur = s.step > 0 ? (steps[s.step - 1] as Obj) : null;
  let used = 0;
  for (const i of inWindow) used += cands[i]!.tokens as number;
  const placed = view.placed[packer][placement] as Obj;
  const curve = data.curve as number[][];
  const answerIn = (pk.chosen as number[]).some(
    (i) => cands[i]!.relevant as boolean,
  );
  const ev = data.eval.results[budget][packer] as Obj;

  const hl = done
    ? "pos"
    : packer === "optimal"
      ? "value"
      : cur && !cur.take
        ? "budget"
        : "weight";
  const focus = hover ?? hl;

  const X0 = 8;
  const CW = (W - 16) / 10;
  const cellY = (i: number) => 22 + Math.floor(i / 10) * 40;
  const barY = 116;
  const xB = (t: number) => X0 + ((W - 16) * t) / Math.max(B, 1);
  const plY = 214;
  const plTop = 172;
  const xP = (f: number) => X0 + (W - 16) * f;
  const yP = (p: number) => plY - 8 - (p - 0.4) * 110;

  const fullCaption = packingCaption(view, packer, placement, s.step);

  let acc = 0;
  let accP = 0;
  const totalP = (placed.order as number[]).reduce(
    (a: number, i: number) => a + (cands[i]!.tokens as number),
    0,
  );

  const visual = (
    <div className="mx-auto max-w-xl">
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Packing ${cands.length} candidates into ${B} tokens with the ${packer} packer: ${fmtInt(used)} tokens used.`}
      >
        <defs>
          <Hatch id="pack-skip" />
        </defs>
        <text
          x={X0}
          y={14}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          Candidates by rank (value 1/log₂(rank+1), tokens)
        </text>
        {cands.map((c, i) => {
          const x = X0 + (i % 10) * CW;
          const y = cellY(i);
          const isCur = cur?.i === i;
          const st =
            packer === "optimal"
              ? done && finalSet.has(i)
                ? "taken"
                : seen.has(i)
                  ? "seen"
                  : "idle"
              : seen.has(i)
                ? taken.includes(i)
                  ? "taken"
                  : "skipped"
                : "idle";
          return (
            <g key={i} data-cand={st} data-rel={c.relevant ? "true" : "false"}>
              <rect
                x={x + 1}
                y={y}
                width={CW - 2}
                height={30}
                rx={2}
                fill={
                  st === "taken"
                    ? KIND_COLOUR.read
                    : st === "skipped"
                      ? "url(#pack-skip)"
                      : "none"
                }
                fillOpacity={
                  st === "taken" ? 0.35 + 0.65 * (c.value as number) : 1
                }
                stroke={
                  isCur
                    ? STATE_COLOUR.active
                    : c.relevant
                      ? RELEVANT
                      : MUTED.light
                }
                strokeWidth={isCur ? 2.5 : c.relevant ? 2 : 1}
                data-focus={
                  focus === "weight" || focus === "value" ? "true" : "false"
                }
              />
              <text
                x={x + CW / 2}
                y={y + 13}
                textAnchor="middle"
                style={{ fontSize: fs(9) }}
                className="fill-neutral-900 font-medium dark:fill-neutral-100"
              >
                {c.relevant ? `✓${c.rank as number}` : (c.rank as number)}
              </text>
              {!font.narrow && (
                <text
                  x={x + CW / 2}
                  y={y + 25}
                  textAnchor="middle"
                  style={{ fontSize: fs(8) }}
                  className="fill-neutral-600 dark:fill-neutral-400"
                >
                  {c.tokens as number}
                </text>
              )}
            </g>
          );
        })}

        <text
          x={X0}
          y={barY - 6}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          The window ({fmtInt(used)} of {fmtInt(B)} tokens)
        </text>
        <rect
          x={X0}
          y={barY}
          width={W - 16}
          height={22}
          fill="none"
          stroke={MUTED.light}
        />
        {inWindow.map((i) => {
          const x0 = xB(acc);
          acc += cands[i]!.tokens as number;
          return (
            <rect
              key={i}
              data-packed={i}
              x={x0}
              y={barY}
              width={Math.max(1, xB(acc) - x0)}
              height={22}
              fill={cands[i]!.relevant ? RELEVANT : KIND_COLOUR.read}
              fillOpacity={0.85}
              stroke="#ffffff"
              strokeWidth={0.8}
            />
          );
        })}
        <line
          data-budget="true"
          x1={xB(B)}
          x2={xB(B)}
          y1={barY - 3}
          y2={barY + 25}
          stroke={focus === "budget" ? STATE_COLOUR.stalled : "currentColor"}
          strokeWidth={focus === "budget" ? 2.5 : 1.5}
          strokeDasharray="4 2"
          className="text-neutral-700 dark:text-neutral-300"
        />

        <text
          x={X0}
          y={plTop - 10}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          {font.narrow ? "Placed" : "The packed set placed"} {placement}:
          p(position)
        </text>
        <polyline
          data-curve="true"
          points={curve.map(([x, p]) => `${xP(x!)},${yP(p!)}`).join(" ")}
          fill="none"
          stroke={focus === "pos" ? STATE_COLOUR.active : OKABE_ITO.purple}
          strokeWidth={focus === "pos" ? 2.5 : 1.5}
        />
        {(placed.order as number[]).map((i, j) => {
          const x0 = xP(accP / Math.max(totalP, 1));
          accP += cands[i]!.tokens as number;
          const x1 = xP(accP / Math.max(totalP, 1));
          const rel = cands[i]!.relevant as boolean;
          const px = (placed.positions as number[])[j]!;
          return (
            <g key={i} data-placed={rel ? "answer" : "other"}>
              <rect
                x={x0}
                y={plY}
                width={Math.max(1, x1 - x0)}
                height={18}
                fill={rel ? RELEVANT : KIND_COLOUR.read}
                fillOpacity={
                  rel ? 0.9 : 0.35 + 0.65 * (cands[i]!.value as number)
                }
                stroke="#ffffff"
                strokeWidth={0.8}
              />
              {rel && (
                <circle
                  cx={xP(px)}
                  cy={yP(placed.p as number)}
                  r={4}
                  fill={RELEVANT}
                  stroke={STATE_COLOUR.active}
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}
        <text
          x={X0}
          y={H - 6}
          style={{ fontSize: fs(9) }}
          className="fill-neutral-600 dark:fill-neutral-400"
        >
          start
        </text>
        <text
          x={W - 8}
          y={H - 6}
          textAnchor="end"
          style={{ fontSize: fs(9) }}
          className="fill-neutral-600 dark:fill-neutral-400"
        >
          end of the context
        </text>
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      testId="packing-widget"
      title="Packing a token budget"
      summary="Twenty reranked candidates, a budget of B tokens. The greedy packers take what fits; the dynamic programme finds the most value. Then where the set goes, under an illustrative position curve. Frames from the engine's packingView."
      stepper={s}
      stepLabel="step"
      countFrom={0}
      caption={fullCaption}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Window"
            value={`${fmtInt(used)} / ${fmtInt(B)}`}
            hint="tokens packed so far"
          />
          <Stat
            label="Value"
            value={(pk.value as number).toFixed(2)}
            hint={`final set of ${pk.chosen.length}`}
          />
          <Stat
            label="This answer"
            value={answerIn ? `p ${(placed.p as number).toFixed(2)}` : "missed"}
            hint={answerIn ? `placed ${placement}` : "not in the window"}
          />
          <Stat
            label="200 questions"
            value={pct(ev.answered as number, 1)}
            hint={`answer in the window (${packer})`}
          />
        </div>
      }
      params={
        <>
          <Choice
            label="Question"
            value={q}
            options={qs.map((x) => ({
              value: String(x.q),
              label: clip(x.question as string, 52),
            }))}
            onChange={setQ}
          />
          <Segmented
            label="Budget B (tokens)"
            value={budget}
            options={BUDGETS.map((b) => ({ value: b, label: b }))}
            onChange={setBudget}
          />
          <Segmented
            label="Packer"
            value={packer}
            options={PACKERS.map((p) => ({ value: p, label: p }))}
            onChange={setPacker}
          />
          <Segmented
            label="Placement"
            value={placement}
            options={PLACEMENTS.map((p) => ({ value: p, label: p }))}
            onChange={setPlacement}
          />
        </>
      }
    />
  );
}
