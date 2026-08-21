import { ClayCard } from "../../clay";
import { narrationLog } from "../../lib/trace";
import type { TraceStep } from "../../lib/types";

export function NarrationLog({ steps, playhead }: { steps: TraceStep[]; playhead: number }) {
  const lines = narrationLog(steps, playhead, 7);

  return (
    <ClayCard title="What it is doing" tilt={false}>
      {lines.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
          Press play to watch the algorithm narrate itself, step by step.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {lines.map((line, index) => {
            const isCurrent = index === lines.length - 1;
            return (
              <li
                key={`${playhead}-${index}`}
                className="text-xs leading-relaxed px-3 py-2"
                style={{
                  background: isCurrent ? "var(--clay-accent-soft)" : "transparent",
                  color: isCurrent ? "var(--clay-text)" : "var(--clay-text-muted)",
                  borderRadius: "var(--clay-radius-sm)",
                  fontWeight: isCurrent ? 700 : 400,
                  // Older lines fade, so the eye lands on the current step.
                  opacity: isCurrent ? 1 : 0.5 + index * 0.07,
                }}
              >
                {line}
              </li>
            );
          })}
        </ol>
      )}
    </ClayCard>
  );
}
