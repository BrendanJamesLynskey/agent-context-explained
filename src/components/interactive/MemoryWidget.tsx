"use client";

/**
 * Chapter 8's hero: memory across sessions. Six sessions of research, each ending with the window
 * gone and only the memory left; probes in later sessions ask about earlier ones. The store is drawn
 * item by item (width = tokens): transcript reads, scratchpad notes, episodes or facts; the items a
 * probe puts in the call light up, and the probe is ticked (recalled) or hatched (not). Below, recall
 * against memory tokens read for every policy. Frames are the engine's `memoryRun`.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Choice, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { memoryCaption } from "@/lib/ctx/captions";
import { fmtInt } from "@/lib/format";
import {
  MEMORY_COLOUR,
  MUTED,
  OKABE_ITO,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { Hatch } from "./Hatch";
import { useEngine } from "./useEngine";

const W = 360;
const H = 314;
const POLICIES = [
  "none",
  "transcript",
  "scratchpad",
  "scratchpad-cap",
  "episodic",
  "episodic-cap",
  "semantic",
  "semantic-cap",
] as const;
type Policy = (typeof POLICIES)[number];
const LABEL: Record<Policy, string> = {
  none: "none",
  transcript: "transcript (everything)",
  scratchpad: "scratchpad (notes file)",
  "scratchpad-cap": "scratchpad, capped at 128 tokens",
  episodic: "episodic (top 3 episodes)",
  "episodic-cap": "episodic, at most 8 episodes",
  semantic: "semantic (top 3 facts)",
  "semantic-cap": "semantic, at most 10 facts",
};

function itemKind(id: string): string {
  return id.split(" ")[0]!;
}

export default function MemoryWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("memory");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Memory data={st.data}>{children}</Memory>;
}

function Memory({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const [policy, setPolicy] = useState<Policy>("episodic");
  const [hover, setHover] = useState<string | null>(null);
  const font = useSvgFont(W);
  const fs = font.fs;
  const run = data.runs[policy] as Obj;
  const frames = run.frames as Obj[];
  const s = useStepper(frames.length, { stepMs: 700, resetKey: policy });
  const f = frames[s.step]!;
  const plan = data.plan as Obj;
  const nS = (plan.sessions as Obj[]).length;
  const store = f.store as Obj[];
  const got = new Set(f.got as string[]);

  // probe outcomes so far, per session
  const outcomes: Obj[][] = Array.from({ length: nS + 1 }, () => []);
  for (const x of frames.slice(0, s.step + 1))
    if (x.event === "probe") outcomes[x.session as number]!.push(x);

  const hl =
    f.event === "probe"
      ? policy.startsWith("episodic")
        ? "score"
        : policy.startsWith("semantic")
          ? "rel"
          : "read"
      : f.event === "write"
        ? "write"
        : "read";
  const focus = hover ?? hl;

  const X0 = 8;
  // the store: a flow of blocks, width proportional to tokens (one scale for every policy)
  const maxStored = Math.max(
    ...POLICIES.map((p) => {
      let m = 0;
      for (const x of (data.runs[p] as Obj).frames as Obj[]) {
        let t = 0;
        for (const it of x.store as Obj[]) t += it.tokens as number;
        m = Math.max(m, t + 4 * (x.store as Obj[]).length);
      }
      return m;
    }),
  );
  const rows = 4;
  const rowW = W - 16;
  const scale = (rowW * rows * 0.96) / Math.max(1, maxStored);
  const blocks: { it: Obj; x: number; y: number; w: number }[] = [];
  let bx = X0;
  let by = 98;
  for (const it of store) {
    const w = Math.max(3, (it.tokens as number) * scale);
    if (bx + w > X0 + rowW) {
      bx = X0;
      by += 20;
    }
    blocks.push({ it, x: bx, y: by, w });
    bx += w + 2;
  }

  // the scatter: recall against memory tokens read, log x
  const pts: { name: string; read: number; rec: number; probes: number }[] = [
    ...POLICIES.map((p) => ({
      name: p as string,
      read: (data.runs[p] as Obj).read_tokens as number,
      rec: (data.runs[p] as Obj).recalled as number,
      probes: (data.runs[p] as Obj).probes as number,
    })),
    ...Object.entries(data.sweep as Obj).map(([name, r]) => ({
      name,
      read: (r as Obj).read_tokens as number,
      rec: (r as Obj).recalled as number,
      probes: (r as Obj).probes as number,
    })),
  ];
  const px0 = 44;
  const px1 = W - 14;
  const py0 = 298;
  const py1 = 226;
  const lx = (t: number) =>
    px0 + ((px1 - px0) * (Math.log10(Math.max(t, 100)) - 2)) / 3;
  const ly = (r: number) => py0 - (py0 - py1) * r;

  const visual = (
    <div className="mx-auto max-w-xl">
      <svg
        ref={font.ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Memory policy ${policy}: ${f.recalled as number} of ${f.probes as number} probes recalled so far, ${f.read as number} memory tokens read.`}
      >
        <defs>
          <Hatch id="mem-miss" />
        </defs>
        <text
          x={X0}
          y={14}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          Sessions and their probes
        </text>
        {Array.from({ length: nS + 1 }, (_, i) => {
          const cw = (W - 16) / (nS + 1);
          const x = X0 + i * cw;
          const now = f.session === i;
          return (
            <g key={i} data-session={i}>
              <rect
                x={x + 1}
                y={22}
                width={cw - 2}
                height={20}
                rx={3}
                fill={now ? STATE_COLOUR.active : "none"}
                fillOpacity={now ? 0.18 : 0}
                stroke={now ? STATE_COLOUR.active : MUTED.light}
              />
              <text
                x={x + cw / 2}
                y={36}
                textAnchor="middle"
                style={{ fontSize: fs(9) }}
                className="fill-neutral-800 dark:fill-neutral-200"
              >
                {i < nS ? `S${i + 1}` : "final"}
              </text>
              {outcomes[i]!.map((o, j) => (
                <circle
                  key={j}
                  data-probe={o.ok ? "recalled" : "missed"}
                  cx={x + 8 + (j % 4) * ((cw - 12) / 3.4)}
                  cy={52 + Math.floor(j / 4) * 12}
                  r={4.5}
                  fill={o.ok ? OKABE_ITO.green : "url(#mem-miss)"}
                  stroke={
                    o === f
                      ? STATE_COLOUR.active
                      : o.ok
                        ? OKABE_ITO.green
                        : STATE_COLOUR.stalled
                  }
                  strokeWidth={o === f ? 2.5 : 1}
                />
              ))}
            </g>
          );
        })}

        <text
          x={X0}
          y={90}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          Memory: {store.length} item{store.length === 1 ? "" : "s"}
          {font.narrow ? "" : " (width = tokens)"}
        </text>
        {blocks.map(({ it, x, y, w }) => {
          const k = itemKind(it.id as string);
          const hit = got.has(it.id as string);
          return (
            <rect
              key={it.id as string}
              data-mem={k}
              data-got={hit ? "true" : "false"}
              x={x}
              y={y}
              width={w}
              height={16}
              rx={2}
              fill={MEMORY_COLOUR[k] ?? MUTED.light}
              fillOpacity={hit ? 0.95 : 0.4}
              stroke={hit ? STATE_COLOUR.active : "none"}
              strokeWidth={hit ? 2 : 0}
            />
          );
        })}
        {!store.length && (
          <text
            x={X0}
            y={112}
            style={{ fontSize: fs(9) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            (empty)
          </text>
        )}

        <text
          x={X0}
          y={194}
          style={{ fontSize: fs(10) }}
          className="fill-neutral-700 dark:fill-neutral-300"
        >
          Recall against memory tokens read (all policies)
        </text>
        <line x1={px0} x2={px1} y1={py0} y2={py0} stroke={MUTED.light} />
        <line x1={px0} x2={px0} y1={py1} y2={py0} stroke={MUTED.light} />
        <g style={{ fontSize: fs(8.5) }}>
          {(
            [
              ["chunk", "reads, episodes"],
              ["note", "notes"],
              ["fact", "facts"],
            ] as const
          ).map(([k, label], j) => (
            <g key={k} transform={`translate(${8 + j * ((W - 16) / 3)}, 212)`}>
              <rect x={0} y={-8} width={9} height={9} fill={MEMORY_COLOUR[k]} />
              <text
                x={12}
                y={0}
                className="fill-neutral-700 dark:fill-neutral-300"
              >
                {label}
              </text>
            </g>
          ))}
        </g>
        {[100, 1000, 10000, 100000].map((t) => (
          <text
            key={t}
            x={lx(t)}
            y={H - 1}
            textAnchor="middle"
            style={{ fontSize: fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {t >= 1000 ? `${t / 1000}k` : "≤100"}
          </text>
        ))}
        {[0, 1].map((v) => (
          <text
            key={v}
            x={px0 - 4}
            y={ly(v) + (v ? 4 : -2)}
            textAnchor="end"
            style={{ fontSize: fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {v === 1 ? "all" : "0"}
          </text>
        ))}
        {pts.map((p) => {
          const me = p.name === policy;
          const k = p.name.split(/[ -]/)[0]!;
          return (
            <circle
              key={p.name}
              data-point={p.name}
              cx={lx(p.read)}
              cy={ly(p.rec / p.probes)}
              r={me ? 6 : 3.5}
              fill={
                MEMORY_COLOUR[
                  k === "scratchpad"
                    ? "note"
                    : k === "semantic"
                      ? "fact"
                      : k === "none"
                        ? "none"
                        : "chunk"
                ] ?? MUTED.light
              }
              fillOpacity={me ? 1 : 0.55}
              stroke={me ? STATE_COLOUR.active : "none"}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );

  return (
    <AnimationPanel
      testId="memory-widget"
      title="Memory across sessions"
      summary="Six sessions of research, then probes about earlier sessions. Each policy keeps something different between sessions; the probe's items light up. Frames from the engine's memoryRun."
      stepper={s}
      stepLabel="event"
      countFrom={0}
      caption={memoryCaption(f)}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Recalled"
            value={`${f.recalled as number} of ${f.probes as number}`}
            hint={`probes so far (${run.recalled as number} of ${run.probes as number} in all)`}
          />
          <Stat
            label="Memory read"
            value={fmtInt(f.read as number)}
            hint="tokens put into probe calls"
          />
          <Stat
            label="Memory written"
            value={fmtInt(f.write as number)}
            hint="tokens of model calls"
          />
          <Stat
            label="Stored"
            value={fmtInt(
              store.reduce(
                (a: number, it: Obj) => a + (it.tokens as number),
                0,
              ),
            )}
            hint="tokens in memory now"
          />
        </div>
      }
      params={
        <Choice
          label="Memory policy"
          value={policy}
          options={POLICIES.map((p) => ({ value: p, label: LABEL[p] }))}
          onChange={setPolicy}
        />
      }
    />
  );
}
