"use client";

import { useEffect, useState } from "react";
import { slaState, type SlaTone } from "@/lib/sla-status";

const TONE_BAR: Record<SlaTone, string> = {
  none: "bg-line",
  ok: "bg-accent",
  warn: "bg-warn",
  breach: "bg-critical",
  met: "bg-good",
  missed: "bg-critical",
};

const TONE_TEXT: Record<SlaTone, string> = {
  none: "text-ink-faint",
  ok: "text-ink-soft",
  warn: "text-warn",
  breach: "text-critical",
  met: "text-good",
  missed: "text-critical",
};

type Props = {
  assignedAt: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  showBar?: boolean;
};

/// Live countdown. The clock is the product, so it ticks in front of the
/// officer rather than only updating on reload.
export function SlaMeter({ assignedAt, dueAt, resolvedAt, showBar = true }: Props) {
  // The current time only exists on the client. Rendering it during the server
  // pass would produce markup that cannot match hydration, so an open ticket
  // shows a neutral placeholder until the first tick lands.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Deferred rather than called in the effect body: setting state
    // synchronously there would cascade an extra render on every mount.
    const first = setTimeout(() => setNow(new Date()), 0);
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  // A resolved ticket's verdict is fixed — it beat its deadline or it didn't —
  // so it renders identically on both sides and needs no clock.
  const settled = resolvedAt !== null;
  const state = settled || now ? slaState({ assignedAt, dueAt, resolvedAt }, now ?? undefined) : null;

  if (!state) {
    return (
      <div className="w-full">
        <div className="font-mono text-xs text-ink-faint">
          {dueAt ? "SLA running" : "No clock running"}
        </div>
        {showBar && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`flex items-baseline justify-between gap-2 font-mono text-xs ${TONE_TEXT[state.tone]}`}
      >
        <span>{state.label}</span>
        {state.tone !== "none" && (
          <span className="tnum text-ink-faint">
            {Math.min(999, Math.round(state.fraction * 100))}%
          </span>
        )}
      </div>
      {showBar && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${TONE_BAR[state.tone]}`}
            style={{ width: `${Math.min(100, Math.max(2, state.fraction * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
