"use client";

/**
 * Code-split client widgets: each loads its own chunk after the page shell, so pages stay
 * light (the pattern of the companion sites' lazy.tsx). Each widget takes its equation as
 * server-rendered children.
 */
import dynamic from "next/dynamic";

function Placeholder({ what }: { what: string }): JSX.Element {
  return (
    <p
      data-pending-widget
      className="my-8 min-h-96 text-sm text-neutral-600 dark:text-neutral-400"
    >
      Loading the {what}…
    </p>
  );
}

const loading = (what: string) =>
  function Loading(): JSX.Element {
    return <Placeholder what={what} />;
  };

export const WindowWidget = dynamic(() => import("./WindowWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const Bm25Widget = dynamic(() => import("./Bm25Widget"), {
  ssr: false,
  loading: loading("animation"),
});
export const DenseWidget = dynamic(() => import("./DenseWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const HybridWidget = dynamic(() => import("./HybridWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const ChunkWidget = dynamic(() => import("./ChunkWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const PackingWidget = dynamic(() => import("./PackingWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const CompactionWidget = dynamic(() => import("./CompactionWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const MemoryWidget = dynamic(() => import("./MemoryWidget"), {
  ssr: false,
  loading: loading("animation"),
});
export const CostWidget = dynamic(() => import("./CostWidget"), {
  ssr: false,
  loading: loading("animation"),
});
