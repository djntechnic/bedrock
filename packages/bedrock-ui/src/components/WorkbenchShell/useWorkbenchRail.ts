/**
 * @file useWorkbenchRail.ts
 * @module @djntechnic/bedrock-ui/components/WorkbenchShell
 * @description Collapse state for the workbench rail (spec §3.3). A stored
 * choice is explicit user intent and always beats the viewport; only when
 * nothing is stored does a viewport under 1280px start the rail collapsed. A
 * resize never rewrites a stored value, and the viewport default is never
 * persisted — only a user toggle is.
 *
 * Ctrl/Cmd+B is a local `keydown` listener: `KeyboardShortcutsProvider`
 * exposes no binding-registration API. Move it there once it offers one.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const RAIL_COLLAPSED_KEY = "bedrock_workbench_rail_collapsed";
const WIDE_VIEWPORT = "(min-width: 1280px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function readStored(): boolean | null {
  try {
    const value = localStorage.getItem(RAIL_COLLAPSED_KEY);
    return value === "true" ? true : value === "false" ? false : null;
  } catch {
    return null;
  }
}

function writeStored(collapsed: boolean): void {
  try {
    localStorage.setItem(RAIL_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Storage denied (private mode): the toggle still works for this session.
  }
}

function matches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** Keystrokes in a field belong to the field (Ctrl+B is bold in rich text). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

export interface WorkbenchRail {
  collapsed: boolean;
  toggle: () => void;
  /** False under `prefers-reduced-motion`: the width transition is dropped. */
  animate: boolean;
}

export function useWorkbenchRail(): WorkbenchRail {
  const [collapsed, setCollapsed] = useState<boolean>(() => readStored() ?? !matches(WIDE_VIEWPORT));
  const [animate] = useState<boolean>(() => !matches(REDUCED_MOTION));
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  const toggle = useCallback(() => {
    const next = !collapsedRef.current;
    collapsedRef.current = next;
    writeStored(next);
    setCollapsed(next);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
