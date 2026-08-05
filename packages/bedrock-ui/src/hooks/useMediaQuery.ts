/**
 * @file useMediaQuery.ts
 * @module frontend/src/hooks
 * @description Subscribes to a CSS media query via `matchMedia`, re-rendering
 *              when it flips. Used to drive the sidebar's overlay breakpoint
 *              (<1024px, matching §S9's `--breakpoint-lg` token) without a
 *              resize-event listener.
 */
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
