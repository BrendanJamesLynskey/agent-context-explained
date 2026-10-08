"use client";

/**
 * Chapter 2: BM25 scored live for a query. The query's terms are added one at a time and the top
 * chunks' running scores grow (the engine's `bm25View` frames); beside them the two curves that
 * shape every term's contribution: term-frequency saturation (set by k1) and length normalisation
 * (set by b). Pick a question or type a query; k1 and b re-run the engine (in the worker).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { Choice, Slider, Stat } from "@/components/ui/Controls";
import { useSvgFont } from "@/components/viz/useSvgFont";
import type { Obj } from "@/lib/engine";
import { lengthCurve, tfCurve } from "@/lib/engine/vendor/context/views";
import { clip, trim } from "@/lib/format";
import {
  ARTICLE_COLOUR,
  OKABE_ITO,
  RELEVANT,
  STATE_COLOUR,
} from "@/lib/viz/palette";

import { EngineStatus } from "../agent/EngineStatus";
import { bm25Remote, useEngine } from "./useEngine";

const W = 360;
const H = 200;
const CW = 170;
const CH = 110;

export default function Bm25Widget({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const st = useEngine("lexical");
  if (st.status !== "ready")
    return (
      <EngineStatus error={st.status === "error" ? st.error : undefined} />
    );
  return <Bm25 data={st.data}>{children}</Bm25>;
}

function Bm25({
  data,
  children,
}: {
  data: Obj;
  children?: ReactNode;
}): JSX.Element {
  const questions = data.questions as Obj[];
  const options = [
    ...questions.map((q) => ({
      value: `q${q.q}`,
      label: `Q: ${clip(q.question as string, 44)}`,
    })),
    ...(data.free as string[]).map((t, i) => ({
      value: `f${i}`,
      label: `“${clip(t, 44)}”`,
    })),
    { value: "typed", label: "Type your own…" },
  ];
  const [pick, setPick] = useState(options[0]!.value);
  const [typed, setTyped] = useState("how hot is the sun");
  const [k1, setK1] = useState(1.2);
  const [b, setB] = useState(0.75);
  const [hover, setHover] = useState<string | null>(null);
  const query =
    pick === "typed"
      ? typed
      : pick.startsWith("q")
        ? (questions.find((q) => `q${q.q}` === pick)!.question as string)
        : (data.free as string[])[Number(pick.slice(1))]!;
  const qi = pick.startsWith("q") ? Number(pick.slice(1)) : null;
  const rel = new Set<number>(
    qi !== null ? (data.relevant[qi] as number[]) : [],
  );
  const preset =
    k1 === 1.2 && b === 0.75 && pick !== "typed"
      ? (data.views[query] as Obj | undefined)
      : undefined;
  const [remote, setRemote] = useState<Obj | null>(null);
  useEffect(() => {
    if (preset) return;
    let live = true;
    const t = setTimeout(() => {
      bm25Remote(query, k1, b).then((v) => live && setRemote(v));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [preset, query, k1, b]);
  const view =
    preset ??
    (remote && remote.query === query && remote.k1 === k1 && remote.b === b
      ? remote
      : null);
  const frames = (view?.frames as Obj[] | undefined) ?? [];
  const n = Math.max(1, frames.length);
  const s = useStepper(n, {
    stepMs: 1100,
    resetKey: `${query}|${k1}|${b}|${view ? 1 : 0}`,
  });
  const f = frames[s.step];
  const font = useSvgFont(W);
  const fs = font.fs;
  const cfont = useSvgFont(CW);
  // at k1 = 0 the factor is 0/0 at tf = 0; it is 0 there (no occurrence, no score)
  const tf = useMemo(
    () => tfCurve(k1, b, 1).map(([x, y]) => [x!, Number.isFinite(y) ? y! : 0]),
    [k1, b],
  );
  const len = useMemo(
    () =>
      lengthCurve(k1, b, 1).map(([x, y]) => [x!, Number.isFinite(y) ? y! : 0]),
    [k1, b],
  );
  const hl = f ? "idf" : "";
  const focus = hover ?? hl;

  const top = (f?.top as Obj[] | undefined) ?? [];
  const maxScore = Math.max(
    1e-9,
    ...((view?.top as Obj[]) ?? []).map((r) => r.score as number),
  );
  const chunks = (view?.chunks ?? {}) as Record<string, Obj>;
  const leader = top[0] ? chunks[top[0].chunk as number] : undefined;

  const bars = (
    <svg
      ref={font.ref}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={
        f
          ? `After the term “${f.term}”, the top chunk is ${top[0]?.chunk}.`
          : "Scoring…"
      }
    >
      {top.map((t, i) => {
        const c = chunks[t.chunk as number];
        const y = 8 + i * 22;
        const w = ((W - 110) * (t.score as number)) / maxScore;
        const isRel = rel.has(t.chunk as number);
        return (
          <g
            key={t.chunk as number}
            data-chunk={t.chunk}
            data-relevant={isRel ? "true" : "false"}
          >
            <text
              x={4}
              y={y + 13}
              style={{ fontSize: fs(9) }}
              className="fill-neutral-700 dark:fill-neutral-300"
            >
              {isRel ? "✓ " : ""}chunk {t.chunk as number}
            </text>
            <rect
              x={78}
              y={y}
              width={Math.max(1, w)}
              height={17}
              fill={c ? ARTICLE_COLOUR[c.article as number] : OKABE_ITO.sky}
              stroke={isRel ? RELEVANT : i === 0 ? STATE_COLOUR.active : "none"}
              strokeWidth={isRel ? 3 : 2}
            />
            <text
              x={82 + w}
              y={y + 13}
              style={{ fontSize: fs(9) }}
              className="fill-neutral-900 dark:fill-neutral-100"
            >
              {trim(t.score as number)}
            </text>
          </g>
        );
      })}
      {!top.length && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          style={{ fontSize: fs(11) }}
          className="fill-neutral-600 dark:fill-neutral-400"
        >
          {view ? "No query term is in the corpus." : "Scoring…"}
        </text>
      )}
    </svg>
  );

  const curve = (
    pts: number[][],
    xmax: number,
    ymax: number,
    label: string,
    xlabel: string,
    key: string,
    mark?: number,
  ) => (
    <svg
      ref={key === "tf" ? cfont.ref : undefined}
      viewBox={`0 0 ${CW} ${CH}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
      data-curve={key}
      data-focus={focus === key ? "true" : "false"}
    >
      <text
        x={4}
        y={11}
        style={{ fontSize: cfont.fs(9) }}
        className="fill-neutral-700 dark:fill-neutral-300"
      >
        {label}
      </text>
      <line
        x1={22}
        y1={CH - 18}
        x2={CW - 4}
        y2={CH - 18}
        stroke={STATE_COLOUR.active}
        strokeOpacity={0.3}
      />
      <polyline
        fill="none"
        stroke={focus === key ? STATE_COLOUR.active : OKABE_ITO.orange}
        strokeWidth={focus === key ? 3 : 2}
        points={pts
          .map(
            ([x, y]) =>
              `${22 + ((CW - 28) * x!) / xmax},${CH - 18 - ((CH - 36) * y!) / ymax}`,
          )
          .join(" ")}
      />
      {key === "tf" && (
        <g>
          <line
            x1={22}
            x2={CW - 4}
            y1={CH - 18 - (CH - 36)}
            y2={CH - 18 - (CH - 36)}
            stroke="currentColor"
            strokeDasharray="3 2"
            className="text-neutral-500"
          />
          <text
            x={CW - 4}
            y={CH - 18 - (CH - 36) + 12}
            textAnchor="end"
            style={{ fontSize: cfont.fs(8.5) }}
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            k1 + 1 = {(k1 + 1).toFixed(1)}
          </text>
        </g>
      )}
      {mark !== undefined && (
        <line
          x1={22 + ((CW - 28) * mark) / xmax}
          x2={22 + ((CW - 28) * mark) / xmax}
          y1={16}
          y2={CH - 18}
          stroke="currentColor"
          strokeDasharray="3 2"
          className="text-neutral-500"
        />
      )}
      <text
        x={CW - 4}
        y={CH - 4}
        textAnchor="end"
        style={{ fontSize: cfont.fs(8.5) }}
        className="fill-neutral-600 dark:fill-neutral-400"
      >
        {xlabel}
      </text>
    </svg>
  );

  const visual = (
    <div className="min-w-0">
      <p
        className="mb-2 break-words text-sm text-neutral-800 dark:text-neutral-200"
        data-testid="query"
      >
        Query: <span className="font-medium">{query}</span>
      </p>
      <div className="grid min-w-0 gap-3 md:grid-cols-[3fr_2fr]">
        <div className="min-w-0">{bars}</div>
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-1">
          {curve(tf, 10, k1 + 1, "tf saturation", "tf →", "tf")}
          {curve(
            len,
            4,
            Math.max(...len.map((p) => p[1]!)) * 1.05,
            "length, tf = 1",
            "dl / avgdl →",
            "len",
            1,
          )}
        </div>
      </div>
      {leader && (
        <p
          tabIndex={0}
          className="focus-ring mt-2 max-h-28 overflow-y-auto break-words rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-300 dark:ring-neutral-800"
          data-testid="leader-text"
        >
          <span className="font-medium">Chunk {leader.chunk as number}</span> (
          {leader.title as string}, {leader.tokens as number} tokens):{" "}
          {clip(leader.text as string, 360)}
        </p>
      )}
    </div>
  );

  return (
    <AnimationPanel
      testId="bm25-widget"
      title="BM25, one query term at a time"
      summary="Each frame adds one query term's contribution to every chunk; bars are the running scores of the top eight. Frames from the engine's bm25View; a ✓ marks the chunk that holds the answer."
      stepper={s}
      stepLabel="term"
      caption={
        f
          ? (f.caption as string)
          : view
            ? "No query term is in the corpus."
            : "Scoring…"
      }
      visual={visual}
      equation={children}
      hl={focus}
      onEquationHover={setHover}
      stats={
        view ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Chunks (N)" value={String(view.n)} />
            <Stat
              label="avgdl"
              value={trim(view.avgdl as number)}
              hint="terms per chunk"
            />
            <Stat
              label="Query terms"
              value={String((view.terms as Obj[]).length)}
              hint="after stop words"
            />
            <Stat
              label="Top score"
              value={
                top[0] ? trim((view.top as Obj[])[0]!.score as number) : "–"
              }
            />
          </div>
        ) : undefined
      }
      params={
        <>
          <Choice
            label="Query"
            value={pick}
            options={options}
            onChange={setPick}
          />
          {pick === "typed" ? (
            <label className="flex min-w-0 flex-col gap-1 text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Your query
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="focus-ring h-11 rounded border border-neutral-300 bg-white px-2 text-sm normal-case tracking-normal text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                data-testid="typed-query"
              />
            </label>
          ) : (
            <span />
          )}
          <Slider
            label="k1 (saturation)"
            value={k1}
            min={0}
            max={3}
            step={0.1}
            onChange={setK1}
            format={(v) => v.toFixed(1)}
          />
          <Slider
            label="b (length normalisation)"
            value={b}
            min={0}
            max={1}
            step={0.05}
            onChange={setB}
            format={(v) => v.toFixed(2)}
          />
        </>
      }
    />
  );
}
