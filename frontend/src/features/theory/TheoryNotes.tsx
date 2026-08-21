import type { AlgorithmKey } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

/**
 * Margin notes, not the manual.
 *
 * The full Theory tab still carries everything. This is the compressed version
 * that sits beside a running plot: the first few mechanical steps, the cost, and
 * one strength against one weakness. Anything longer competes with the thing it
 * is annotating, and in a live demo the plot has to win.
 */
export function TheoryNotes({ algorithm }: { algorithm: AlgorithmKey }) {
  const spec = useAppStore((s) => s.specs?.[algorithm]);
  if (!spec) return null;

  const { theory } = spec;
  // The complexity blurb runs to a paragraph in the registry; the headline
  // sentence is the part worth reading next to a chart.
  const complexity = theory.complexity.split(". ")[0] + ".";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
        {theory.summary}
      </p>

      <div>
        <Eyebrow>How it works</Eyebrow>
        <ol className="flex flex-col gap-1.5 mt-1.5">
          {theory.how_it_works.slice(0, 4).map((line, i) => (
            <li key={i} className="flex gap-2 text-[11px] leading-snug">
              <span
                className="shrink-0 font-black tabular-nums"
                style={{ color: "var(--clay-accent)" }}
              >
                {i + 1}
              </span>
              <span style={{ color: "var(--clay-text-muted)" }}>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <Eyebrow>Cost</Eyebrow>
        <p
          className="text-[11px] leading-snug mt-1.5"
          style={{ color: "var(--clay-text-muted)" }}
        >
          {complexity}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Eyebrow>Good at</Eyebrow>
          <ul className="mt-1.5 flex flex-col gap-1">
            {theory.strengths.slice(0, 2).map((line, i) => (
              <li
                key={i}
                className="text-[11px] leading-snug"
                style={{ color: "var(--clay-text-muted)" }}
              >
                <span style={{ color: "var(--clay-good)" }}>+ </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Eyebrow>Breaks on</Eyebrow>
          <ul className="mt-1.5 flex flex-col gap-1">
            {theory.weaknesses.slice(0, 2).map((line, i) => (
              <li
                key={i}
                className="text-[11px] leading-snug"
                style={{ color: "var(--clay-text-muted)" }}
              >
                <span style={{ color: "var(--clay-warn)" }}>− </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] font-black uppercase tracking-[0.18em]"
      style={{ color: "var(--clay-text-faint)" }}
    >
      {children}
    </div>
  );
}
