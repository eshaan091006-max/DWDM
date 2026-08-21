import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to the new one.
 *
 * This is not only decoration: when a parameter change quietly shifts the
 * silhouette from 0.61 to 0.58, a number that rolls draws the eye to the change
 * in a way a number that simply swaps does not.
 *
 * Non-finite input (a metric the backend reports as undefined) skips straight
 * to the target so nothing tries to tween toward NaN.
 */
export function useCountUp(target: number | null, durationMs = 550): number | null {
  const [value, setValue] = useState<number | null>(target);
  const fromRef = useRef<number>(target ?? 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null || !Number.isFinite(target)) {
      setValue(target);
      fromRef.current = 0;
      return;
    }

    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || durationMs <= 0) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic: fast at first, settling gently onto the final value.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}
