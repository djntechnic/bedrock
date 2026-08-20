/**
 * @file KeyboardShortcutsContext.tsx
 * @module frontend/src/context
 * @description Global keyboard shortcut manager. Mounts a single window keydown
 * observer that interprets the configured help key, chorded navigation
 * sequences (e.g. "G D"), and the appearance toggle, while cleanly bypassing any
 * keystroke originating inside a text-entry primitive. All state transitions and
 * hotkey activations emit structured Pino telemetry — never bare console output.
 *
 * Every tunable (help key, sequence latency, enable flag) is resolved through
 * the centralized {@link ShortcutsConfig} rather than hardcoded here, satisfying
 * the schema-driven configuration contract.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme, BUILT_IN_THEMES } from "./ThemeContext";
import { logger } from "../lib/logger";
import {
  buildShortcutGroups,
  resolveShortcutsConfig,
  type ShortcutCategory,
} from "../lib/shortcuts";
import type { ShortcutsConfig } from "../types/grid";

/** How a sheet open/close transition was triggered — recorded in telemetry. */
export type ShortcutSource =
  | "hotkey"
  | "footer_button"
  | "escape"
  | "overlay"
  | "programmatic";

interface KeyboardShortcutsContextValue {
  /** Whether the shortcuts reference sheet is currently open. */
  isOpen: boolean;
  /** Open the sheet, recording the trigger source for telemetry. */
  open: (source?: ShortcutSource) => void;
  /** Close the sheet, recording the trigger source for telemetry. */
  close: (source?: ShortcutSource) => void;
  /** Toggle the sheet, recording the trigger source for telemetry. */
  toggle: (source?: ShortcutSource) => void;
  /** Raw open-state setter passed to Radix `onOpenChange`. */
  setOpen: (next: boolean, source?: ShortcutSource) => void;
  /** Resolved, config-driven shortcut categories for presentation. */
  groups: ShortcutCategory[];
  /** The resolved shortcut configuration (help key, timeouts, flags). */
  config: ShortcutsConfig;
}

const KeyboardShortcutsContext =
  createContext<KeyboardShortcutsContextValue | null>(null);

/** Route destinations for the `G <key>` navigation chords. */
const SEQUENCE_ROUTES: Record<string, string> = {
  d: "/",
  l: "/leaderboards",
  r: "/rankings",
  t: "/trends",
  p: "/players",
};

/**
 * True when focus rests inside a text-entry primitive where global single-key
 * shortcuts must not fire (native inputs, textareas, selects, contenteditable
 * regions, and ARIA comboboxes). Modifier-based chords are gated separately by
 * their callers.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute("role") === "combobox") return true;
  return false;
}

interface ProviderProps {
  children: ReactNode;
  /** Optional user/DB preference overrides merged onto config defaults. */
  configOverrides?: Partial<ShortcutsConfig> | null;
}

export function KeyboardShortcutsProvider({
  children,
  configOverrides,
}: ProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeThemeId, resolvedThemeId, palettes, setActiveTheme } = useTheme();

  const config = useMemo(
    () => resolveShortcutsConfig(configOverrides),
    [configOverrides]
  );
  const groups = useMemo(() => buildShortcutGroups(config), [config]);

  const [isOpen, setIsOpen] = useState(false);

  // Refs keep the window listener stable while still reading fresh values.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const setOpen = useCallback(
    (next: boolean, source: ShortcutSource = "programmatic") => {
      setIsOpen((prev) => {
        if (prev === next) return prev;
        logger.info(
          next
            ? "KeyboardShortcutsSheet: opened"
            : "KeyboardShortcutsSheet: closed",
          {
            state: next ? "open" : "close",
            source,
            activeView: locationRef.current,
            activeElement:
              typeof document !== "undefined"
                ? document.activeElement?.tagName ?? null
                : null,
          }
        );
        return next;
      });
    },
    []
  );

  const open = useCallback(
    (source: ShortcutSource = "programmatic") => setOpen(true, source),
    [setOpen]
  );
  const close = useCallback(
    (source: ShortcutSource = "programmatic") => setOpen(false, source),
    [setOpen]
  );
  const toggle = useCallback(
    (source: ShortcutSource = "programmatic") => {
      const next = !isOpenRef.current;
      logger.info("KeyboardShortcutsSheet: toggled", {
        state: "toggle",
        nextState: next ? "open" : "close",
        source,
        activeView: locationRef.current,
      });
      setIsOpen(next);
    },
    []
  );

  const toggleTheme = useCallback(() => {
    // Resolved, not chosen: in system mode `activeThemeId` names no palette,
    // and the hotkey should flip away from what the operator can actually see.
    const active = palettes.find((p) => p.id === resolvedThemeId);
    const nextId = active?.isDark ? "mlb-classic" : "night-game";
    const target =
      palettes.find((p) => p.id === nextId) ?? BUILT_IN_THEMES[0];
    logger.info("Appearance: theme mutation via hotkey", {
      hotkeyTrigger: "mod+shift+l",
      fromTheme: activeThemeId,
      toTheme: target.id,
      activeView: locationRef.current,
    });
    setActiveTheme(target.id);
  }, [activeThemeId, resolvedThemeId, palettes, setActiveTheme]);

  // ─── Global keydown observer ────────────────────────────────────────────────
  useEffect(() => {
    if (!config.shortcutsEnabled) return;

    let sequencePrefix: string | null = null;
    let sequenceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearSequence = () => {
      sequencePrefix = null;
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);
      const activeTag =
        e.target instanceof HTMLElement ? e.target.tagName : null;

      // Appearance toggle: Cmd/Ctrl + Shift + L. Allowed even outside inputs;
      // requires the modifier chord so it never collides with typed text.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        clearSequence();
        toggleTheme();
        return;
      }

      // Single-key shortcuts below must never fire inside text-entry primitives,
      // nor when a command/alt modifier is held.
      if (editable || e.metaKey || e.ctrlKey || e.altKey) {
        clearSequence();
        return;
      }

      // Help key toggles the reference sheet.
      if (e.key === config.helpKey) {
        e.preventDefault();
        clearSequence();
        logger.info("Shortcut: help matrix toggled", {
          hotkeyTrigger: config.helpKey,
          activeElement: activeTag,
          activeView: locationRef.current,
        });
        toggle("hotkey");
        return;
      }

      // Two-key navigation chords: "G" then a destination key.
      const key = e.key.toLowerCase();
      if (sequencePrefix === "g" && SEQUENCE_ROUTES[key]) {
        e.preventDefault();
        const to = SEQUENCE_ROUTES[key];
        logger.info("Shortcut: navigation sequence", {
          hotkeyTrigger: `g ${key}`,
          to,
          activeElement: activeTag,
          activeView: locationRef.current,
        });
        clearSequence();
        navigate(to);
        return;
      }

      if (key === "g") {
        clearSequence();
        sequencePrefix = "g";
        sequenceTimer = setTimeout(clearSequence, config.sequenceTimeoutMs);
        return;
      }

      // Any other key aborts a pending sequence prefix.
      clearSequence();
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearSequence();
    };
  }, [config, navigate, toggle, toggleTheme]);

  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({ isOpen, open, close, toggle, setOpen, groups, config }),
    [isOpen, open, close, toggle, setOpen, groups, config]
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

/** Access the global keyboard shortcut manager. */
export function useKeyboardShortcuts(): KeyboardShortcutsContextValue {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error(
      "useKeyboardShortcuts must be used inside a KeyboardShortcutsProvider"
    );
  }
  return ctx;
}
