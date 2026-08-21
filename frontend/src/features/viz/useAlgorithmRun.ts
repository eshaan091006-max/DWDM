import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../lib/api";
import { guardCureParams } from "../../lib/cureGuard";
import type { AlgorithmKey } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

/** Above this many points a recorded trace is more payload than it is worth. */
export const TRACE_LIMIT = 800;

/**
 * Runs one algorithm and keeps its result in the store.
 *
 * Each section on the page owns its own instance, so all three results coexist
 * rather than one overwriting the next. The run is deferred until the section is
 * actually scrolled into view: the backend is single-threaded, and firing all
 * three at once makes them contend for the GIL — measured earlier at 21s for a
 * DBSCAN that normally takes 20ms. Deferring also means CURE's cubic merge phase
 * is not paid for until someone scrolls far enough to care.
 */
export function useAlgorithmRun(algorithm: AlgorithmKey, inView: boolean) {
  const points = useAppStore((s) => s.points);
  const params = useAppStore((s) => s.params[algorithm]);
  const standardize = useAppStore((s) => s.standardize);
  const recordTrace = useAppStore((s) => s.recordTrace);
  const autoRun = useAppStore((s) => s.autoRun);
  const setResult = useAppStore((s) => s.setResult);
  const setError = useAppStore((s) => s.setError);

  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<number | null>(null);
  // Leaving Explore for Compare or Theory unmounts every section while its
  // fetch may still be in flight. Without this the resolved promise writes back
  // through a dead component's state setter.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (points.length === 0) return;
    setBusy(true);
    try {
      const effective =
        algorithm === "cure" ? guardCureParams(params, points.length).params : params;
      const result = await api.cluster(algorithm, {
        points,
        params: effective,
        record_trace: recordTrace && points.length <= TRACE_LIMIT,
        standardize,
      });
      // The store is global and outlives the section, so a completed result is
      // still worth keeping; only the local busy flag must not be touched.
      setResult(algorithm, result);
      setError(null);
    } catch (caught) {
      if (aliveRef.current) setError((caught as Error).message);
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [algorithm, points, params, recordTrace, standardize, setResult, setError]);

  useEffect(() => {
    if (!autoRun || !inView || points.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void run(), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [run, autoRun, inView, points.length]);

  return { run, busy };
}

/**
 * Ramps 0 to 1 each time `key` changes, then holds at 1.
 *
 * CURE's overlay interpolates its representatives between their scattered and
 * shrunken positions, but every call site passed a literal 1, so the shrink was
 * only ever drawn at its end state — the one thing the algorithm is named for
 * was never visible. Driving this from the playhead means landing on a shrink
 * step plays the representatives inward.
 *
 * Under reduced motion it sits at 1: the final position, no movement.
 */
export function useStepProgress(key: unknown, durationMs = 280): number {
  const [progress, setProgress] = useState(1);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || durationMs <= 0) {
      setProgress(1);
      return;
    }

    const start = performance.now();
    setProgress(0);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setProgress(t);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [key, durationMs]);

  return progress;
}

/**
 * True once the element has been scrolled into view; stays true afterwards.
 *
 * Falls open: if IntersectionObserver is unavailable the element counts as seen
 * immediately, so a missing API can never leave a section permanently blank or
 * permanently un-run.
 */
export function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const node = ref.current;
    if (!node || seen || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, rootMargin]);

  return { ref, seen };
}
