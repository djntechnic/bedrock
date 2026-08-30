import { jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme, BUILT_IN_THEMES } from "./ThemeContext.js";
import { logger } from "../lib/logger.js";
import { resolveShortcutsConfig, buildShortcutGroups } from "../lib/shortcuts.js";
const KeyboardShortcutsContext = createContext(null);
const SEQUENCE_ROUTES = {
  d: "/",
  l: "/leaderboards",
  r: "/rankings",
  t: "/trends",
  p: "/players"
};
function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute("role") === "combobox") return true;
  return false;
}
function KeyboardShortcutsProvider({
  children,
  configOverrides
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeThemeId, resolvedThemeId, palettes, setActiveTheme } = useTheme();
  const config = useMemo(
    () => resolveShortcutsConfig(configOverrides),
    [configOverrides]
  );
  const groups = useMemo(() => buildShortcutGroups(config), [config]);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const setOpen = useCallback(
    (next, source = "programmatic") => {
      setIsOpen((prev) => {
        if (prev === next) return prev;
        logger.info(
          next ? "KeyboardShortcutsSheet: opened" : "KeyboardShortcutsSheet: closed",
          {
            state: next ? "open" : "close",
            source,
            activeView: locationRef.current,
            activeElement: typeof document !== "undefined" ? document.activeElement?.tagName ?? null : null
          }
        );
        return next;
      });
    },
    []
  );
  const open = useCallback(
    (source = "programmatic") => setOpen(true, source),
    [setOpen]
  );
  const close = useCallback(
    (source = "programmatic") => setOpen(false, source),
    [setOpen]
  );
  const toggle = useCallback(
    (source = "programmatic") => {
      const next = !isOpenRef.current;
      logger.info("KeyboardShortcutsSheet: toggled", {
        state: "toggle",
        nextState: next ? "open" : "close",
        source,
        activeView: locationRef.current
      });
      setIsOpen(next);
    },
    []
  );
  const toggleTheme = useCallback(() => {
    const active = palettes.find((p) => p.id === resolvedThemeId);
    const nextId = active?.isDark ? "mlb-classic" : "night-game";
    const target = palettes.find((p) => p.id === nextId) ?? BUILT_IN_THEMES[0];
    logger.info("Appearance: theme mutation via hotkey", {
      hotkeyTrigger: "mod+shift+l",
      fromTheme: activeThemeId,
      toTheme: target.id,
      activeView: locationRef.current
    });
    setActiveTheme(target.id);
  }, [activeThemeId, resolvedThemeId, palettes, setActiveTheme]);
  useEffect(() => {
    if (!config.shortcutsEnabled) return;
    let sequencePrefix = null;
    let sequenceTimer = null;
    const clearSequence = () => {
      sequencePrefix = null;
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = null;
      }
    };
    const handler = (e) => {
      const editable = isEditableTarget(e.target);
      const activeTag = e.target instanceof HTMLElement ? e.target.tagName : null;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        clearSequence();
        toggleTheme();
        return;
      }
      if (editable || e.metaKey || e.ctrlKey || e.altKey) {
        clearSequence();
        return;
      }
      if (e.key === config.helpKey) {
        e.preventDefault();
        clearSequence();
        logger.info("Shortcut: help matrix toggled", {
          hotkeyTrigger: config.helpKey,
          activeElement: activeTag,
          activeView: locationRef.current
        });
        toggle("hotkey");
        return;
      }
      const key = e.key.toLowerCase();
      if (sequencePrefix === "g" && SEQUENCE_ROUTES[key]) {
        e.preventDefault();
        const to = SEQUENCE_ROUTES[key];
        logger.info("Shortcut: navigation sequence", {
          hotkeyTrigger: `g ${key}`,
          to,
          activeElement: activeTag,
          activeView: locationRef.current
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
      clearSequence();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      clearSequence();
    };
  }, [config, navigate, toggle, toggleTheme]);
  const value = useMemo(
    () => ({ isOpen, open, close, toggle, setOpen, groups, config }),
    [isOpen, open, close, toggle, setOpen, groups, config]
  );
  return /* @__PURE__ */ jsx(KeyboardShortcutsContext.Provider, { value, children });
}
function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error(
      "useKeyboardShortcuts must be used inside a KeyboardShortcutsProvider"
    );
  }
  return ctx;
}
export {
  KeyboardShortcutsProvider,
  isEditableTarget,
  useKeyboardShortcuts
};
//# sourceMappingURL=KeyboardShortcutsContext.js.map
