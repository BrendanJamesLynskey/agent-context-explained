/**
 * scripts/smoke-check.ts
 *
 * Post-deploy smoke check, adapted from the companion sites'. Fetches every page and the
 * data files the animations need, and exits non-zero if any fails:
 *
 *     pnpm smoke https://agent-context-explained.vercel.app
 *
 * With no argument it checks http://localhost:3000. For a protected preview deployment, pass
 * the bypass token as VERCEL_BYPASS (sent as the `x-vercel-protection-bypass` header; never
 * printed).
 *
 * Fails when a page is not a 200 (redirects count as failures) or lacks the content that
 * proves it rendered from the engine: the landing page must print the engine's own numbers
 * (computed here with the same code), the data page every shipped file's checksum, every
 * chapter its MDX (a layer, server-rendered KaTeX, the animation's placeholder), and the header
 * the two-group site switch. The tokenizer and every data file must be the vendored ones.
 */
import { createHash } from "node:crypto";

import { formatValue, lookup } from "@/lib/ctx/values";
import VENDORED from "@/lib/engine/vendor/VENDORED.json";
import { SECTIONS } from "@/lib/mdx/sections";

type Result = { path: string; ok: boolean; detail: string };

const headers: Record<string, string> = process.env.VERCEL_BYPASS
  ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS }
  : {};

const SWITCH = [
  'data-site-switch="full"',
  'data-site-switch="compact"',
  'href="https://agent-harnesses-explained.vercel.app"',
  'href="https://agent-protocols-explained.vercel.app"',
  "Context",
  'href="https://gpu-kernels-explained.vercel.app"',
];

async function checkPage(
  base: string,
  path: string,
  mustContain: string[],
): Promise<Result> {
  try {
    const res = await fetch(base + path, { redirect: "manual", headers });
    if (res.status !== 200)
      return { path, ok: false, detail: String(res.status) };
    const html = await res.text();
    const missing = mustContain.filter((s) => !html.includes(s));
    if (missing.length)
      return {
        path,
        ok: false,
        detail: `200 but missing ${missing.join(", ")}`,
      };
    return { path, ok: true, detail: "200" };
  } catch (err) {
    return { path, ok: false, detail: (err as Error).message };
  }
}

async function checkFile(base: string, published: string): Promise<Result> {
  const path = "/" + published.replace(/^public\//, "");
  try {
    const res = await fetch(base + path, { redirect: "manual", headers });
    if (res.status !== 200)
      return { path, ok: false, detail: String(res.status) };
    const sha = createHash("sha256")
      .update(Buffer.from(await res.arrayBuffer()))
      .digest("hex");
    const want = (VENDORED.files as Record<string, { sha256: string }>)[
      published
    ]!.sha256;
    return sha === want
      ? { path, ok: true, detail: "200, SHA-256 matches" }
      : { path, ok: false, detail: `SHA-256 ${sha}` };
  } catch (err) {
    return { path, ok: false, detail: (err as Error).message };
  }
}

async function main(): Promise<void> {
  const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
  const checks: Promise<Result>[] = [
    checkPage(base, "/", [
      "Agent Context Explained",
      formatValue(lookup("hybrid.evals.rerank.mean.recall@1"), "pct"),
      formatValue(lookup("corpus.questions"), "int"),
      ...SWITCH,
    ]),
    checkPage(
      base,
      "/data",
      Object.values(lookup("manifest.files") as Record<string, string>).map(
        (h) => h.slice(0, 24),
      ),
    ),
    checkPage(base, "/about", ["The engine", VENDORED.commit.slice(0, 7)]),
    checkPage(
      base,
      "/learn",
      SECTIONS.map((x) => x.slug),
    ),
    ...SECTIONS.map((x) =>
      checkPage(base, `/learn/${x.slug}`, [
        'data-layer="concept"',
        "data-pending-widget",
        'class="katex"',
        ...SWITCH,
      ]),
    ),
    ...Object.keys(VENDORED.files)
      .filter((p) => p.startsWith("public/"))
      .map((p) => checkFile(base, p)),
  ];
  const results = await Promise.all(checks);
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "ok  " : "FAIL"} ${r.path} ${r.detail}`);
  }
  console.log(
    `${results.length - failed}/${results.length} checks passed against ${base}`,
  );
  if (failed) process.exit(1);
}

void main();
