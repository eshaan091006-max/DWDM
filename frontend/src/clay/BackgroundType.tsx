/**
 * Oversized type drifting behind the interface.
 *
 * Four rows at different speeds and alternating directions, set in outline only.
 * The parallax comes free: a row moving at 90s reads as further away than one at
 * 38s, so the layer has depth without any scroll maths.
 *
 * It sits behind the grid and every card, and it is drawn as stroke-only text at
 * low opacity — the one hard rule here is that it must never compete with a
 * cluster plot or a number. If you can read it without looking for it, it is
 * too loud.
 */
const ROWS: { text: string; top: string; speed: number; reverse?: boolean }[] = [
  { text: "DBSCAN · BIRCH · CURE · ", top: "4%", speed: 52 },
  { text: "DENSITY REACHABILITY · CORE · BORDER · NOISE · ", top: "27%", speed: 78, reverse: true },
  { text: "CLUSTERING FEATURES · CF-TREE · THRESHOLD · ", top: "52%", speed: 44 },
  { text: "REPRESENTATIVES · SHRINK · MERGE · ", top: "76%", speed: 92, reverse: true },
];

export function BackgroundType() {
  return (
    <div className="bg-type" aria-hidden="true">
      {ROWS.map((row) => (
        <div
          key={row.top}
          className="bg-type-row"
          style={{
            top: row.top,
            animationDuration: `${row.speed}s`,
            animationDirection: row.reverse ? "reverse" : "normal",
          }}
        >
          {/* Two copies, translated -50%: the same seamless-loop trick the
              ticker uses, with no measurement. */}
          <span className="bg-type-run">{row.text.repeat(6)}</span>
          <span className="bg-type-run">{row.text.repeat(6)}</span>
        </div>
      ))}
    </div>
  );
}
