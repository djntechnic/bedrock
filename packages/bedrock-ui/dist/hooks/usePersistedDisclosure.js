import { useState, useEffect, useCallback } from "react";
import { log } from "../utils/logger.js";
const DISCLOSURE_KEY_PREFIX = "mlbtracker.gridEditor.";
function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
  }
}
function usePersistedDisclosure(key, defaultOpen = true) {
  const storageKey = key.startsWith(DISCLOSURE_KEY_PREFIX) ? key : `${DISCLOSURE_KEY_PREFIX}${key}`;
  const [open, setOpenState] = useState(
    () => typeof window === "undefined" ? defaultOpen : readStorage(storageKey, defaultOpen)
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpenState(readStorage(storageKey, defaultOpen));
  }, [storageKey]);
  const setOpen = useCallback(
    (next) => {
      setOpenState(next);
      writeStorage(storageKey, next);
      log.info(
        { component: "GridEditor", action: "disclosure.toggle", key: storageKey, open: next },
        "GridEditor: disclosure toggled"
      );
    },
    [storageKey]
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return [open, setOpen, toggle];
}
export {
  DISCLOSURE_KEY_PREFIX,
  usePersistedDisclosure
};
//# sourceMappingURL=usePersistedDisclosure.js.map
