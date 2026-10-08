"use client";

/**
 * Shown while the engine (in a Web Worker) plays a chapter's MCP sessions
 * runs, or if that fails. Same height as an animation, so the page does not jump.
 */
export function EngineStatus({ error }: { error?: string }): JSX.Element {
  return (
    <p
      data-pending-widget
      role="status"
      className="my-8 flex min-h-96 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
    >
      {error
        ? `The simulator could not run here: ${error}`
        : "Running the protocol simulator…"}
    </p>
  );
}
