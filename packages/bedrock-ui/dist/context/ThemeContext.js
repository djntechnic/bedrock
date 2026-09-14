import { jsxs, jsx } from "react/jsx-runtime";
import { createContext, useState, useEffect, useContext } from "react";
import { Toaster } from "../components/ui/sonner.js";
import { BUILT_IN_THEMES } from "../theme/palettes.js";
import { DEFAULT_THEME_SEED } from "../theme/palettes.js";
const SYSTEM_THEME_ID = "system";
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
function hexLuminance(hex) {
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(parseInt(hex.slice(1, 3), 16)) + 0.7152 * toLinear(parseInt(hex.slice(3, 5), 16)) + 0.0722 * toLinear(parseInt(hex.slice(5, 7), 16));
}
function isDark(hex) {
  return hexLuminance(hex) < 0.2;
}
function adjustHex(hex, amount) {
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
function fgFor(hex) {
  return isDark(hex) ? "0 0% 100%" : "222 47% 11%";
}
function buildCssVars(palette) {
  if (palette.cssVars) return palette.cssVars;
  const bgDark = isDark(palette.colorBackground);
  const mutedHex = bgDark ? adjustHex(palette.colorBackground, 20) : adjustHex(palette.colorBackground, -8);
  const cardHex = bgDark ? adjustHex(palette.colorBackground, 12) : palette.colorBackground;
  const mutedFg = bgDark ? "215 18% 62%" : "215 16% 50%";
  const fg = bgDark ? "210 35% 93%" : "222 47% 11%";
  return {
    "--background": hexToHsl(palette.colorBackground),
    "--foreground": fg,
    "--card": hexToHsl(cardHex),
    "--card-foreground": fg,
    "--popover": hexToHsl(cardHex),
    "--popover-foreground": fg,
    "--primary": hexToHsl(palette.colorPrimary),
    "--primary-foreground": fgFor(palette.colorPrimary),
    "--secondary": hexToHsl(palette.colorSecondary),
    "--secondary-foreground": fgFor(palette.colorSecondary),
    "--muted": hexToHsl(mutedHex),
    "--muted-foreground": mutedFg,
    "--accent": hexToHsl(palette.colorAccent),
    "--accent-foreground": fgFor(palette.colorAccent),
    "--destructive": hexToHsl(palette.colorDestructive),
    "--destructive-foreground": "0 0% 100%",
    "--border": hexToHsl(palette.colorBorder),
    "--input": hexToHsl(palette.colorBorder),
    "--ring": hexToHsl(palette.colorPrimary),
    // Scoreboard tokens (§S009) — theme-invariant identity colors, bumped
    // lighter for dark backgrounds to match the built-in themes' pattern.
    "--scoreboard-accent": bgDark ? "38 92% 62%" : "38 92% 55%",
    "--live-pulse": bgDark ? "330 88% 66%" : "330 85% 55%",
    // Rank-medal identity tokens (§S009) — same theme-invariant treatment as
    // the scoreboard tokens above; gold/silver/bronze have no status meaning.
    "--rank-gold": bgDark ? "43 96% 62%" : "43 96% 56%",
    "--rank-silver": bgDark ? "215 20% 72%" : "215 20% 65%",
    "--rank-bronze": bgDark ? "27 96% 66%" : "27 96% 61%",
    // Chart-role tokens (§S009) — aliased to existing semantic tokens so each
    // theme's chart colors track its own identity automatically.
    "--chart-1": "var(--primary)",
    "--chart-2": "var(--scoreboard-accent)",
    "--chart-3": "var(--positive)"
  };
}
const SCOREBOARD_TOKEN_KEYS = ["--scoreboard-accent", "--live-pulse"];
const CHART_TOKEN_KEYS = ["--chart-1", "--chart-2", "--chart-3"];
const RANK_TOKEN_KEYS = ["--rank-gold", "--rank-silver", "--rank-bronze"];
function patchLegacyCssVars(palette) {
  if (!palette.cssVars) return palette;
  const missingScoreboard = SCOREBOARD_TOKEN_KEYS.some((key) => !(key in palette.cssVars));
  const missingChart = CHART_TOKEN_KEYS.some((key) => !(key in palette.cssVars));
  const missingRank = RANK_TOKEN_KEYS.some((key) => !(key in palette.cssVars));
  if (!missingScoreboard && !missingChart && !missingRank) return palette;
  return {
    ...palette,
    cssVars: {
      "--scoreboard-accent": palette.isDark ? "38 92% 62%" : "38 92% 55%",
      "--live-pulse": palette.isDark ? "330 88% 66%" : "330 85% 55%",
      "--rank-gold": palette.isDark ? "43 96% 62%" : "43 96% 56%",
      "--rank-silver": palette.isDark ? "215 20% 72%" : "215 20% 65%",
      "--rank-bronze": palette.isDark ? "27 96% 66%" : "27 96% 61%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)",
      ...palette.cssVars
    }
  };
}
const ThemeContext = createContext(null);
const ACTIVE_KEY = "mlbtracker-theme";
const CUSTOM_KEY = "mlbtracker-custom-palettes";
function applyTheme(palette) {
  const vars = buildCssVars(palette);
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  if (palette.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
function resolveSystemPalette(palettes, prefersDark, prefs = {}) {
  const wanted = prefersDark ? prefs.systemDark : prefs.systemLight;
  const named = wanted ? palettes.find((p) => p.id === wanted) : void 0;
  if (named) return named;
  const byPolarity = palettes.find((p) => p.isDark === prefersDark);
  if (byPolarity) return byPolarity;
  return palettes[0] ?? null;
}
function prefersDarkNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function ThemeProvider({
  children,
  systemLight,
  systemDark,
  toaster = true
}) {
  const [activeThemeId, setActiveThemeId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) ?? "mlb-classic"
  );
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [customPalettes, setCustomPalettes] = useState(() => {
    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    } catch {
      return [];
    }
    const patched = stored.map(patchLegacyCssVars);
    if (patched.some((p, i) => p !== stored[i])) {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(patched));
    }
    return patched;
  });
  const palettes = [...BUILT_IN_THEMES, ...customPalettes];
  const resolved = (activeThemeId === SYSTEM_THEME_ID ? resolveSystemPalette(palettes, prefersDark, { systemLight, systemDark }) : palettes.find((p) => p.id === activeThemeId)) ?? BUILT_IN_THEMES[0];
  useEffect(() => {
    applyTheme(resolved);
    localStorage.setItem(ACTIVE_KEY, activeThemeId);
  }, [activeThemeId, resolved]);
  function setActiveTheme(id) {
    setActiveThemeId(id);
  }
  function addPalette(palette) {
    const next = [...customPalettes, palette];
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }
  function updatePalette(palette) {
    const next = customPalettes.map((p) => p.id === palette.id ? palette : p);
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }
  function removePalette(id) {
    const next = customPalettes.filter((p) => p.id !== id);
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    if (activeThemeId === id) setActiveThemeId("mlb-classic");
  }
  return /* @__PURE__ */ jsxs(
    ThemeContext.Provider,
    {
      value: {
        activeThemeId,
        resolvedThemeId: resolved.id,
        palettes,
        setActiveTheme,
        addPalette,
        updatePalette,
        removePalette
      },
      children: [
        children,
        toaster && /* @__PURE__ */ jsx(Toaster, { isDark: resolved.isDark })
      ]
    }
  );
}
function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
export {
  BUILT_IN_THEMES,
  DEFAULT_THEME_SEED,
  SYSTEM_THEME_ID,
  ThemeProvider,
  resolveSystemPalette,
  useTheme
};
//# sourceMappingURL=ThemeContext.js.map
