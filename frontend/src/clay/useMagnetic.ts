import { useCallback, useRef } from "react";

/**
 * Pulls an element a little way toward the cursor while it is hovered.
 *
 * The pull is capped and eased down near the edges, so a button leans toward
 * your pointer without ever drifting far enough that clicking misses it. As
 * with the tilt hook, this writes a transform directly on the node rather than
 * through React state — no re-render per mouse move.
 */
export function useMagnetic(strength = 0.28, max = 7) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const frame = useRef<number | null>(null);

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const node = ref.current;
      if (!node) return;
      const { clientX, clientY } = event;

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const dx = clientX - (rect.left + rect.width / 2);
        const dy = clientY - (rect.top + rect.height / 2);
        const tx = Math.max(-max, Math.min(max, dx * strength));
        const ty = Math.max(-max, Math.min(max, dy * strength));
        node.style.setProperty("--mag-x", `${tx}px`);
        node.style.setProperty("--mag-y", `${ty}px`);
      });
    },
    [strength, max],
  );

  const onMouseLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    node.style.setProperty("--mag-x", "0px");
    node.style.setProperty("--mag-y", "0px");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
