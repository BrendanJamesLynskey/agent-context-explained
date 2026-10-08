/**
 * Chapter catalogue + filesystem loader for /learn content.
 *
 * MDX sources live under `/content/chapters/`, one per mechanism, each built
 * around an animation. Their slugs and order are defined here (single source
 * of truth); the `[slug]` route validates incoming params against this list
 * before reading from disk. Same shape as the companion sites'
 * `src/lib/mdx/sections.ts`.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const SECTIONS = [
  {
    slug: "01-the-window-is-the-working-memory",
    title: "The window is the working memory",
    summary:
      "A twelve-question task in a window too small for it: what the agent knows grows with each read and shrinks when the window is trimmed, compacted or searched again, and what each choice costs in tokens.",
  },
  {
    slug: "02-lexical-retrieval",
    title: "Lexical retrieval: BM25",
    summary:
      "BM25 scored live for a query, term by term: inverse document frequency, term-frequency saturation (k1) and length normalisation (b), measured on 200 labelled questions.",
  },
  {
    slug: "03-dense-retrieval",
    title: "Dense retrieval",
    summary:
      "Chunks and questions as 384-dimensional embeddings: cosine similarity, nearest neighbours on a 2-D projection, and how much recall survives int8, int4 and one-bit vectors.",
  },
  {
    slug: "04-hybrid-and-reranking",
    title: "Hybrid retrieval and reranking",
    summary:
      "Two ranked lists merged by reciprocal rank fusion, rank by rank, then a cross-encoder rereading the top twenty; recall@k for every stage.",
  },
  {
    slug: "05-chunking",
    title: "Chunking",
    summary:
      "One text cut three ways, fixed, recursive and semantic: where the boundaries fall, which answers they cut in two, and what each chunking does to recall.",
  },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]["slug"];

const SLUG_SET = new Set<string>(SECTIONS.map((s) => s.slug));

export function isValidSlug(slug: string): slug is SectionSlug {
  return SLUG_SET.has(slug);
}

export function getSectionMeta(slug: SectionSlug): (typeof SECTIONS)[number] {
  return SECTIONS.find((s) => s.slug === slug) ?? SECTIONS[0];
}

/** Read the raw MDX source for a chapter, or `null` if it doesn't exist. */
export async function readSectionMdx(
  slug: SectionSlug,
): Promise<string | null> {
  const path = join(process.cwd(), "content", "chapters", `${slug}.mdx`);
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}
