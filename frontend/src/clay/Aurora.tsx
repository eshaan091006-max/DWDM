/**
 * Slow-drifting colour field behind the clay surfaces.
 *
 * Purely decorative — aria-hidden, pointer-events none, and it sits beneath
 * every interactive layer. The blobs inherit the active algorithm's accent, so
 * the whole background shifts hue when you switch algorithms.
 */
export function Aurora() {
  return (
    <div className="clay-aurora" aria-hidden="true">
      <span
        style={{
          width: "42vw",
          height: "42vw",
          left: "-6%",
          top: "-4%",
          background: "var(--clay-accent)",
          animationDelay: "0s",
        }}
      />
      <span
        style={{
          width: "34vw",
          height: "34vw",
          right: "-4%",
          top: "22%",
          background: "var(--clay-accent-2)",
          animationDelay: "-7s",
        }}
      />
      <span
        style={{
          width: "38vw",
          height: "38vw",
          left: "28%",
          bottom: "-14%",
          background: "var(--clay-good)",
          animationDelay: "-14s",
        }}
      />
    </div>
  );
}
