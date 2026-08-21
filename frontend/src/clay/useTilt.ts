import { useCallback, useRef } from "react";

/**
 * Cursor-tracked 3D tilt with a specular highlight.
 *
 * Writes CSS custom properties rather than inline transforms, so the browser
 * animates on the compositor and React never re-renders on mouse move — this
 * runs at 60fps beside a canvas that is already doing real work.
 *
 * `maxTilt` stays small on purpose. Past about six degrees a card stops reading
 * as lit clay and starts reading as a novelty, and any text on it gets harder
 * to scan.
 */
export function useTilt(maxTilt = 5) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const node = ref.current;
      if (!node) return;
      const { clientX, clientY } = event;

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        // -0.5 .. 0.5 from the card's own centre.
        const px = (clientX - rect.left) / rect.width - 0.5;
        const py = (clientY - rect.top) / rect.height - 0.5;

        // Pointer below centre tilts the top toward you, so the card leans the
        // way a physical slab under your finger would.
        node.style.setProperty("--ry", `${px * maxTilt * 2}deg`);
        node.style.setProperty("--rx", `${-py * maxTilt * 2}deg`);
        node.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
        node.style.setProperty("--my", `${(py + 0.5) * 100}%`);
        node.style.setProperty("--spec", "1");
        node.style.setProperty("--lift", "1");
      });
    },
    [maxTilt],
  );

  const onMouseLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    node.style.setProperty("--ry", "0deg");
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--spec", "0");
    node.style.setProperty("--lift", "0");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
