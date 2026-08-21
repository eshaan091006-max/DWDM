import type { ReactNode } from "react";

/*
 * Text colours here are chosen by measured contrast, not by eye. Badge text is
 * 11px bold, which WCAG treats as normal-size, so it needs 4.5:1.
 *
 * `accent` previously drew the accent colour on its own soft tint — only
 * 2.91:1 with DBSCAN's orange. Ink on the same tint is 15.86:1 and keeps the
 * accent identity through the fill. `warn` and `good` read their text from
 * tokens that flip per theme where the fill lightens.
 */
const TONES = {
  neutral: { background: "var(--clay-surface-sunken)", color: "var(--clay-text-muted)" },
  accent: { background: "var(--clay-accent-soft)", color: "var(--clay-text)" },
  warn: { background: "var(--clay-warn)", color: "var(--clay-warn-text)" },
  good: { background: "var(--clay-good)", color: "var(--clay-good-text)" },
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
