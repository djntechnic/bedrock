import { useState, useRef, useCallback, useEffect } from "react";
const RAIL_COLLAPSED_KEY = "bedrock_workbench_rail_collapsed";
const WIDE_VIEWPORT = "(min-width: 1280px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function readStored() {
  try {
    const value = localStorage.getItem(RAIL_COLLAPSED_KEY);
    return value === "true" ? true : value === "false" ? false : null;
  } catch {
    return null;
  }
}
function writeStored(collapsed) {
  try {
    localStorage.setItem(RAIL_COLLAPSED_KEY, String(collapsed));
  } catch {
  }
}
function matches(query) {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}
function useWorkbenchRail() {
  const [collapsed, setCollapsed] = useState(() => readStored() ?? !matches(WIDE_VIEWPORT));
  const [animate] = useState(() => !matches(REDUCED_MOTION));
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const toggle = useCallback(() => {
    const next = !collapsedRef.current;
    collapsedRef.current = next;
    writeStored(next);
    setCollapsed(next);
  }, []);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== "b" || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
  return { collapsed, toggle, animate };
}
export {
  RAIL_COLLAPSED_KEY,
  useWorkbenchRail
};
//# sourceMappingURL=useWorkbenchRail.js.map
