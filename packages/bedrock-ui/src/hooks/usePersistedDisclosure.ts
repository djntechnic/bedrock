/**
 * @file usePersistedDisclosure.ts
 * @module frontend/src/hooks
 * @description Small open/closed state hook backed by localStorage with structured
 *              Pino logging on every transition so a support engineer can retrace
 *              an admin's layout state from the log stream. Silent no-op fallback
 *              when localStorage is unavailable (SSR / private mode).
 */

import { useCallback, useEffect, useState } from "react";
import { log } from "../utils/logger";

/** Common namespace prefix — keeps keys grep-able in devtools. */
export const DISCLOSURE_KEY_PREFIX = "mlbtracker.gridEditor.";

function readStorage(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* private mode / SSR — logging below still fires */
  }
}

/**
 * Returns a `[open, setOpen]` tuple. `key` is stored under
 * `mlbtracker.gridEditor.<key>` unless it already begins with the shared prefix.
 * Every state change emits a structured `log.info` for support/telemetry.
 */
export function usePersistedDisclosure(
  key: string,
  defaultOpen: boolean = true,
): [boolean, (next: boolean) => void, () => void] {
  const storageKey = key.startsWith(DISCLOSURE_KEY_PREFIX)
    ? key
    : `${DISCLOSURE_KEY_PREFIX}${key}`;

  const [open, setOpenState] = useState<boolean>(() =>
    typeof window === "undefined" ? defaultOpen : readStorage(storageKey, defaultOpen),
  );

  // Re-sync if the key itself changes (component reused for a different section).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpenState(readStorage(storageKey, defaultOpen));
    // defaultOpen intentionally not in deps — it's a *default*, not a source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      writeStorage(storageKey, next);
      log.info(
        { component: "GridEditor", action: "disclosure.toggle", key: storageKey, open: next },
        "GridEditor: disclosure toggled",
      );
    },
    [storageKey],
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return [open, setOpen, toggle];
}
