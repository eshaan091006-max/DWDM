import type { ReactNode } from "react";

/**
 * A scrolling ticker tape.
 *
 * The content is rendered twice and the track translates exactly -50%, so the
 * second copy arrives where the first began and the loop is seamless with no
 * measurement and no JS. Duration scales with how much text there is, keeping
 * the apparent speed constant whether the strip carries three words or thirty.
 *
 * Under `prefers-reduced-motion` the track stops and the duplicate is hidden
 * from both sight and screen readers, leaving a plain static strip.
 */
export function Marquee({
  children,
  speed = 26,
  reverse = false,
  className = "",
  tone = "ink",
}: {
  children: ReactNode;
  /** Seconds for one full pass. Higher is slower. */
  speed?: number;
  reverse?: boolean;
  className?: string;
  tone?: "ink" | "accent" | "quiet";
}) {
  const palette =
    tone === "accent"
      ? { background: "var(--clay-accent)", color: "var(--clay-accent-text)" }
      : tone === "quiet"
        ? { background: "transparent", color: "var(--clay-text-faint)" }
        : { background: "var(--clay-ink)", color: "var(--clay-paper)" };

  return (
    <div className={`clay-marquee ${className}`} style={palette}>
      <div
        className="clay-marquee-track"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <span className="clay-marquee-run">{children}</span>
        <span className="clay-marquee-run" aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
}

/** One item in a ticker, with the separator brutalism likes: a hard slash. */
export function Tick({ children }: { children: ReactNode }) {
  return (
    <span className="clay-tick">
      {children}
      <span className="clay-tick-sep" aria-hidden="true">
        /
      </span>
    </span>
  );
}
