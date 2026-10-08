/** The pages and animations every e2e spec walks. */
export const PAGES = [
  "/",
  "/learn",
  "/data",
  "/about",
  "/learn/01-the-window-is-the-working-memory",
  "/learn/02-lexical-retrieval",
  "/learn/03-dense-retrieval",
  "/learn/04-hybrid-and-reranking",
  "/learn/05-chunking",
  "/learn/06-packing-the-window",
  "/learn/07-compaction-and-summarisation",
  "/learn/08-agent-memory",
  "/learn/09-long-context-or-retrieval",
] as const;

export const ANIMATIONS = [
  ["/learn/01-the-window-is-the-working-memory", "window-widget"],
  ["/learn/02-lexical-retrieval", "bm25-widget"],
  ["/learn/03-dense-retrieval", "dense-widget"],
  ["/learn/04-hybrid-and-reranking", "hybrid-widget"],
  ["/learn/05-chunking", "chunk-widget"],
  ["/learn/06-packing-the-window", "packing-widget"],
  ["/learn/07-compaction-and-summarisation", "compaction-widget"],
  ["/learn/08-agent-memory", "memory-widget"],
  ["/learn/09-long-context-or-retrieval", "cost-widget"],
] as const;

/** The engine runs in a worker after the page loads (and fetches its data): allow for a slow runner. */
export const ENGINE_TIMEOUT = 45_000;
