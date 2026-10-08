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
] as const;

export const ANIMATIONS = [
  ["/learn/01-the-window-is-the-working-memory", "window-widget"],
  ["/learn/02-lexical-retrieval", "bm25-widget"],
  ["/learn/03-dense-retrieval", "dense-widget"],
  ["/learn/04-hybrid-and-reranking", "hybrid-widget"],
  ["/learn/05-chunking", "chunk-widget"],
] as const;

/** The engine runs in a worker after the page loads (and fetches its data): allow for a slow runner. */
export const ENGINE_TIMEOUT = 45_000;
