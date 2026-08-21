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
        boxShadow: shadow,
        animationDelay: `${delay}ms`,
      }}
    >
      {(title || accent) && (
        <header className="mb-3 clay-layer-1">
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
        </header>
      )}
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </section>
  );
}
