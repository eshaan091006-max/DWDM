import { useEffect, useRef } from "react";

import { ClayBadge, ClayButton } from "../../clay";
import type { TraceStep } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const BASE_STEPS_PER_SECOND = 6;

export function TracePlayer({
  steps,
  truncated,
  sampleRate,
}: {
  steps: TraceStep[];
  truncated: boolean;
  sampleRate: number;
}) {
  const playhead = useAppStore((s) => s.playhead);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const speed = useAppStore((s) => s.speed);
  const setPlayhead = useAppStore((s) => s.setPlayhead);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);

  const frameRef = useRef<number | null>(null);
  const carryRef = useRef(0);
  const lastRef = useRef(0);

  const total = steps.length;
  const atEnd = playhead >= total - 1;

  useEffect(() => {
    if (!isPlaying || total === 0) return;

    lastRef.current = performance.now();
    carryRef.current = 0;

    const tick = (now: number) => {
      // A time accumulator keeps playback frame-rate independent: the same
      // wall-clock speed on a 60Hz and a 144Hz display, and changing speed
      // mid-play does not jump the playhead.
      const elapsed = (now - lastRef.current) / 1000;
      lastRef.current = now;
      carryRef.current += elapsed * BASE_STEPS_PER_SECOND * speed;

      const advance = Math.floor(carryRef.current);
      if (advance >= 1) {
        carryRef.current -= advance;
        const next = useAppStore.getState().playhead + advance;
        if (next >= total - 1) {
          setPlayhead(total - 1);
          setPlaying(false);
          return;
        }
        setPlayhead(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying, speed, total, setPlayhead, setPlaying]);

  if (total === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        No trace recorded. Enable step recording and re-run to animate this algorithm.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClayButton
          size="sm"
          variant="primary"
          onClick={() => {
            if (atEnd) setPlayhead(0);
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? "Pause" : atEnd ? "Replay" : "Play"}
        </ClayButton>
        <ClayButton
          size="sm"
          onClick={() => {
            setPlaying(false);
            setPlayhead(Math.max(0, playhead - 1));
          }}
          title="Step back"
        >
          Back
        </ClayButton>
        <ClayButton
          size="sm"
          onClick={() => {
            setPlaying(false);
            setPlayhead(Math.min(total - 1, playhead + 1));
          }}
          title="Step forward"
        >
          Step
        </ClayButton>
        <ClayButton
          size="sm"
          onClick={() => {
            setPlaying(false);
            setPlayhead(total - 1);
          }}
          title="Jump to the end"
        >
          End
        </ClayButton>

        <span className="flex gap-1 ml-auto">
          {SPEEDS.map((value) => (
            <ClayButton
              key={value}
              size="sm"
              active={speed === value}
              onClick={() => setSpeed(value)}
            >
              {value}x
            </ClayButton>
          ))}
        </span>
      </div>

      <input
        aria-label="Playhead"
        type="range"
        min={0}
        max={total - 1}
        step={1}
        value={playhead}
        onChange={(event) => {
          setPlaying(false);
          setPlayhead(Number(event.target.value));
        }}
        className="w-full h-3 cursor-pointer"
        style={{
          background: "var(--clay-surface-sunken)",
          borderRadius: "999px",
          boxShadow: "var(--clay-shadow-sunken)",
          accentColor: "var(--clay-accent)",
        }}
      />

      <div
        className="flex items-center gap-2 text-[11px] flex-wrap"
        style={{ color: "var(--clay-text-muted)" }}
      >
        <span className="font-mono">
          step {playhead + 1} / {total}
        </span>
        {truncated && (
          <ClayBadge tone="warn">
            sampled 1 in {sampleRate} — the run exceeded the step budget
          </ClayBadge>
        )}
      </div>
    </div>
  );
}
