import type { ReactNode } from "react";

import { ClayCard } from "../../clay";
import type { AlgorithmKey } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <h3
        className="text-[10px] font-bold uppercase tracking-wider mb-2"
        style={{ color: "var(--clay-text-faint)" }}
      >
        {heading}
      </h3>
      {children}
    </div>
  );
}

export function TheoryPanel({ algorithm }: { algorithm: AlgorithmKey }) {
  const spec = useAppStore((state) => state.specs?.[algorithm]);

  if (!spec) {
    return (
      <ClayCard title="Theory">
        <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
          Loading…
        </p>
      </ClayCard>
    );
  }

  const { theory } = spec;

  return (
    <ClayCard title={spec.label} subtitle={spec.tagline} tilt={false}>
      <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--clay-text)" }}>
        {theory.summary}
      </p>

      <Section heading="How it works">
        <ol className="flex flex-col gap-2">
          {theory.how_it_works.map((line, index) => (
            <li key={index} className="flex gap-2.5 text-xs leading-relaxed">
              <span
                className="shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: "var(--clay-accent-soft)",
                  color: "var(--clay-accent)",
                  borderRadius: "999px",
                }}
              >
                {index + 1}
              </span>
              <span style={{ color: "var(--clay-text-muted)" }}>{line}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section heading="Parameters">
        <dl className="flex flex-col gap-2.5">
          {spec.params.map((param) => (
            <div key={param.name}>
              <dt className="text-xs font-bold font-mono" style={{ color: "var(--clay-accent)" }}>
                {param.name}
              </dt>
              <dd
                className="text-xs leading-relaxed mt-0.5"
                style={{ color: "var(--clay-text-muted)" }}
              >
                {theory.parameters[param.name] ?? param.help}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section heading="Complexity">
        <p className="text-xs leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
          {theory.complexity}
        </p>
      </Section>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <Section heading="Strengths">
          <ul className="flex flex-col gap-1.5">
            {theory.strengths.map((line, index) => (
              <li
                key={index}
                className="text-xs leading-relaxed"
                style={{ color: "var(--clay-text-muted)" }}
              >
                <span style={{ color: "var(--clay-good)" }}>+ </span>
                {line}
              </li>
            ))}
          </ul>
        </Section>
        <Section heading="Weaknesses">
          <ul className="flex flex-col gap-1.5">
            {theory.weaknesses.map((line, index) => (
              <li
                key={index}
                className="text-xs leading-relaxed"
                style={{ color: "var(--clay-text-muted)" }}
              >
                <span style={{ color: "var(--clay-warn)" }}>&minus; </span>
                {line}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </ClayCard>
  );
}
