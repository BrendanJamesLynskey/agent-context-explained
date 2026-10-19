/**
 * The learning layer's numbers (brief 44) that are not already a path in the
 * chapters' value tree (`src/lib/ctx/values.ts`): each is a ratio, a difference or
 * a share computed here from the same engine runs the chapters quote, at
 * build time. A self-check cites one as `<Check v="…">`, prose as
 * `<V v="…" />`; tests/unit/learn.test.ts checks every one against the tree.
 */
import { lookup } from "@/lib/ctx/values";

const n = (path: string): number => {
  const v = lookup(path);
  if (typeof v !== "number") throw new Error(`${path} is not a number`);
  return v;
};

const VALUES: Record<string, () => number> = {
  // chapter 7: what re-retrieval spends against compaction alone (loss 0.25, 1,500 tokens)
  "ch07.retrieveOverCompact": () =>
    n("compaction.runs.compact+retrieve-0.25-1500.spent") /
    n("compaction.runs.compact-0.25-1500.spent"),
  // chapter 8: semantic memory's read tokens against episodic memory's
  "ch08.semanticOverEpisodic": () =>
    n("memory.runs.semantic.read_tokens") /
    n("memory.runs.episodic.read_tokens"),
};

export const LEARN_VALUE_NAMES = Object.keys(VALUES);

const CACHE = new Map<string, number>();

export function learnValue(name: string): number {
  const cached = CACHE.get(name);
  if (cached !== undefined) return cached;
  const f = VALUES[name];
  if (!f) throw new Error(`no learn value ${name}`);
  const v = f();
  if (!Number.isFinite(v)) throw new Error(`learn value ${name} is ${v}`);
  CACHE.set(name, v);
  return v;
}
