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
      setResult(algorithm, result);
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
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

/** True once the element has been scrolled into view; stays true afterwards. */
export function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
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
