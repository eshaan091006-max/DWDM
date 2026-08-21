import type { ReactNode } from "react";

import { useTilt } from "./useTilt";

export function ClayCard({
  children,
  title,
  subtitle,
  tone = "raised",
  className = "",
  glow = false,
  delay = 0,
  accent,
  tilt = true,
  step,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  tone?: "raised" | "sunken";
  className?: string;
  /** Adds an accent-tinted halo. Reserve it for the card that leads the view. */
  glow?: boolean;
  /** Stagger for the entrance animation, in milliseconds. */
  delay?: number;
  /** Small label above the title, e.g. a section marker. */
  accent?: string;
  /** Cursor-tracked 3D tilt. Off for cards holding dense scrolling text. */
  tilt?: boolean;
  /**
   * Position in the workflow, e.g. "01". Rendered as a numeral beside the
   * title so someone watching a demo can see the order of operations without
   * being told it.
   */
  step?: string;
  /** Controls pinned to the header row, right-aligned against the title. */
  actions?: ReactNode;
}) {
  const { ref, onMouseMove, onMouseLeave } = useTilt(glow ? 3 : 5);

  const shadow = glow
    ? "var(--clay-shadow-glow)"
    : tone === "sunken"
      ? "var(--clay-shadow-sunken)"
      : "var(--clay-shadow)";

  return (
    <section
      ref={ref as React.Ref<HTMLElement>}
      onMouseMove={tilt ? onMouseMove : undefined}
      onMouseLeave={tilt ? onMouseLeave : undefined}
      className={`p-5 clay-rise ${tilt ? "clay-3d" : ""} ${className}`}
      style={{
        background: tone === "sunken" ? "var(--clay-surface-sunken)" : "var(--clay-surface)",
        borderRadius: "var(--clay-radius-lg)",
        // Every surface carries its border, not just the tilting ones. Structure
        // is exposed here rather than implied by a shadow.
        border: "var(--clay-border)",
        boxShadow: shadow,
        animationDelay: `${delay}ms`,
      }}
    >
      {(title || accent) && (
        <header className="mb-3 clay-layer-1 flex items-start gap-3">
          {step && (
            <span
              aria-hidden="true"
              className="shrink-0 grid place-items-center font-black tabular-nums"
              style={{
                width: 34,
                height: 34,
                fontSize: 13,
                borderRadius: "var(--clay-radius-sm)",
                background: "var(--clay-accent-soft)",
                color: "var(--clay-accent)",
                boxShadow: "var(--clay-shadow-sunken)",
              }}
            >
              {step}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {accent && (
              <div
                className="text-[10px] font-black uppercase tracking-[0.18em] mb-1"
                style={{ color: "var(--clay-accent)" }}
              >
                {accent}
              </div>
            )}
            {title && (
              <h2
                className="text-base font-black tracking-tight"
                style={{ color: "var(--clay-text)" }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "var(--clay-text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </section>
  );
}
