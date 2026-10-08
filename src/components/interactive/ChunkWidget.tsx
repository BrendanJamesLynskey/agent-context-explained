"use client";

/**
 * Chapter 5: one stretch of an article cut three ways. Each row is a chunker; its chunks appear one
 * per step, drawn along the text's characters. On top, the answers of the questions asked about
 * this stretch (whole in a chunk, or cut by a boundary: hatched); below, the similarity of each
 * sentence to the next, which is where the semantic chunker looks for breaks. Boundaries are the
 * engine's chunkers (`chunkView`); the table is each chunking's retrieval over all 200 questions.
 */
import { useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Segmented } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { chunkCaption, chunkSteps, cutAnswers } from "@/lib/ctx/captions";
import {
  CHUNKER_COLOUR,
  MUTED,
  RELEVANT,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { Hatch } from "./Hatch";
import { useEngine } from "./useEngine";

const W = 360;
const H = 236;
const METHODS = ["bm25", "dense", "rrf"] as const;

export default function ChunkWidget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("chunking");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Chunks data={st.data}>{children}</Chunks>;
}

function Chunks({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("dense");
  const [hover, setHover] = useState<string | null>(null);
  const view = data.view as Obj;
  const steps = chunkSteps(view);
  const s = useStepper(steps.length, { stepMs: 700, resetKey: method });
  const cur = steps[s.step]!;
  const font = useSvgFont(W);
  const fs = font.fs;
  const start = view.start as number;
  const end = view.end as number;
  const X0 = 8;
  const x = (c: number) =>
    X0 +
    ((W - 16) * (Math.min(Math.max(c, start), end) - start)) / (end - start);
  const configs = Object.keys(view.configs as Obj);
  const order = configs.indexOf(cur.config);
  const answers = view.answers as Obj[];
  const sents = view.sentences as Obj[];
  const curChunk = (view.configs[cur.config] as Obj[])[cur.index]!;
  const text = data.text as string;
  const hl = cur.config.startsWith("semantic") ? "sim" : "size";
  const focus = hover ?? hl;
  const table = data.table as Record<string, Obj>;

  const visual = (
    <div className="min-w-0">
      <div className="mx-auto max-w-xl">
        <svg
          ref={font.ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={chunkCaption(view, cur)}
        >
          <defs>
            <Hatch id="cut-answer" />
          </defs>
          <text
            x={X0}
            y={12}
            style={{ fontSize: fs(9.5) }}
            className="fill-neutral-700 dark:fill-neutral-300"
          >
            {data.title as string}, characters {start}–{end}: answers asked
            about
          </text>
          {answers.map((a) => {
            const cut = cutAnswers(view, cur.config).includes(a.q as number);
            return (
              <rect
                key={a.q as number}
                x={x(a.start as number)}
                y={18}
                width={Math.max(2.5, x(a.end as number) - x(a.start as number))}
                height={10}
                fill={cut ? "url(#cut-answer)" : RELEVANT}
                stroke={cut ? STATE_COLOUR.stalled : "none"}
                data-answer={cut ? "cut" : "whole"}
              />
            );
          })}
          {configs.map((name, r) => {
            const y = 44 + r * 44;
            const chunks = view.configs[name] as Obj[];
            const shown =
              r < order ? chunks.length : r === order ? cur.index + 1 : 0;
            return (
              <g key={name} data-config={name}>
                <text
                  x={X0}
                  y={y - 3}
                  style={{ fontSize: fs(9.5) }}
                  className="fill-neutral-700 dark:fill-neutral-300"
                >
                  {name}
                </text>
                {chunks.slice(0, shown).map((c, i) => {
                  const active = r === order && i === cur.index;
                  return (
                    <rect
                      key={i}
                      x={x(c.start as number) + 0.8}
                      y={y}
                      width={Math.max(
                        1,
                        x(c.end as number) - x(c.start as number) - 1.6,
                      )}
                      height={22}
                      rx={3}
                      fill={CHUNKER_COLOUR[name]}
                      fillOpacity={i % 2 ? 0.55 : 0.85}
                      stroke={active ? STATE_COLOUR.active : "none"}
                      strokeWidth={2.5}
                    />
                  );
                })}
              </g>
            );
          })}
          <text
            x={X0}
            y={H - 50}
            style={{ fontSize: fs(9.5) }}
            className="fill-neutral-700 dark:fill-neutral-300"
          >
            similarity of each sentence to the next
          </text>
          <polyline
            fill="none"
            stroke={
              focus === "sim"
                ? STATE_COLOUR.active
                : CHUNKER_COLOUR["semantic-256"]
            }
            strokeWidth={focus === "sim" ? 2.5 : 1.8}
            points={sents
              .filter((t) => t.sim_next !== null)
              .map(
                (t) =>
                  `${x(t.end as number)},${H - 8 - 30 * Math.max(0, t.sim_next as number)}`,
              )
              .join(" ")}
          />
          {sents.map((t) => (
            <line
              key={t.i as number}
              x1={x(t.end as number)}
              x2={x(t.end as number)}
              y1={H - 40}
              y2={H - 6}
              stroke={t.paragraph ? "currentColor" : MUTED.light}
              strokeWidth={t.paragraph ? 1.2 : 0.6}
              className="text-neutral-500"
            />
          ))}
        </svg>
      </div>
      <p
        tabIndex={0}
        className="focus-ring mt-2 max-h-36 overflow-y-auto break-words rounded bg-white p-2 text-xs leading-relaxed text-neutral-800 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-200 dark:ring-neutral-800"
        data-testid="chunk-text"
      >
        <span className="font-medium">
          {cur.config}, chunk {cur.index + 1}:
        </span>{" "}
        {(curChunk.start as number) < start ? "…" : ""}
        {text.slice(
          Math.max(0, (curChunk.start as number) - start),
          (curChunk.end as number) - start,
        )}
        {(curChunk.end as number) > end ? "…" : ""}
      </p>
      <div
        className="focus-ring mt-3 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Chunking results"
      >
        <table
          className="w-full min-w-0 text-left text-xs"
          data-testid="chunk-table"
        >
          <thead>
            <tr className="text-neutral-600 dark:text-neutral-400">
              <th className="py-1 pr-2 font-medium">chunking</th>
              <th className="py-1 pr-2 font-medium">chunks</th>
              <th className="py-1 pr-2 font-medium">lost</th>
              <th className="py-1 pr-2 font-medium">R@1</th>
              <th className="py-1 pr-2 font-medium">R@5</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {Object.entries(table).map(([name, row]) => (
              <tr
                key={name}
                className={
                  name === cur.config ? "bg-indigo-50 dark:bg-indigo-950" : ""
                }
              >
                <td className="py-1 pr-2">{name}</td>
                <td className="py-1 pr-2">{row.chunks as number}</td>
                <td className="py-1 pr-2">{row[method].lost as number}</td>
                <td className="py-1 pr-2">
                  {(row[method].mean["recall@1"] as number).toFixed(3)}
                </td>
                <td className="py-1 pr-2">
                  {(row[method].mean["recall@5"] as number).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <AnimationPanel
      testId="chunk-widget"
      title="One text, three chunkers"
      summary="Rows are chunkers; each step lays down one chunk. Green marks are answers held whole; hatched ones are cut by a boundary, and their questions can no longer be answered from one chunk. The table is recall over all 200 questions."
      stepper={s}
      stepLabel="chunk"
      caption={chunkCaption(view, cur)}
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      params={
        <Segmented
          label="Retriever (table)"
          value={method}
          options={METHODS.map((m) => ({ value: m, label: m }))}
          onChange={setMethod}
        />
      }
    />
  );
}
