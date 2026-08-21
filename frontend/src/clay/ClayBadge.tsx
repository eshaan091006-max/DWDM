import type { ReactNode } from "react";

const TONES = {
  neutral: { background: "var(--clay-surface-sunken)", color: "var(--clay-text-muted)" },
  accent: { background: "var(--clay-accent-soft)", color: "var(--clay-accent)" },
  warn: { background: "var(--clay-warn)", color: "#fff" },
  good: { background: "var(--clay-good)", color: "#fff" },
} as const;

export function ClayBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className="inline-block px-2.5 py-1 text-[11px] font-bold"
      style={{ ...TONES[tone], borderRadius: 0 }}
    >
      {children}
    </span>
  );
}
