import { jsxs, jsx } from "react/jsx-runtime";
import { createContext, useState, useEffect, useContext } from "react";
import { Toaster } from "../components/ui/sonner.js";
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
    // Scoreboard tokens (§S9) — theme-invariant identity colors, bumped
    // lighter for dark backgrounds to match the built-in themes' pattern.
    "--scoreboard-accent": bgDark ? "38 92% 62%" : "38 92% 55%",
    "--live-pulse": bgDark ? "330 88% 66%" : "330 85% 55%",
    // Chart-role tokens (§S9) — aliased to existing semantic tokens so each
    // theme's chart colors track its own identity automatically.
    "--chart-1": "var(--primary)",
    "--chart-2": "var(--scoreboard-accent)",
    "--chart-3": "var(--positive)"
  };
}
const SCOREBOARD_TOKEN_KEYS = ["--scoreboard-accent", "--live-pulse"];
const CHART_TOKEN_KEYS = ["--chart-1", "--chart-2", "--chart-3"];
function patchLegacyCssVars(palette) {
  if (!palette.cssVars) return palette;
  const missingScoreboard = SCOREBOARD_TOKEN_KEYS.some((key) => !(key in palette.cssVars));
  const missingChart = CHART_TOKEN_KEYS.some((key) => !(key in palette.cssVars));
  if (!missingScoreboard && !missingChart) return palette;
  return {
    ...palette,
    cssVars: {
      "--scoreboard-accent": palette.isDark ? "38 92% 62%" : "38 92% 55%",
      "--live-pulse": palette.isDark ? "330 88% 66%" : "330 85% 55%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)",
      ...palette.cssVars
    }
  };
}
const DEFAULT_THEME_SEED = {
  colorPrimary: "#1e3a82",
  colorSecondary: "#d8e4f0",
  colorBackground: "#f5f8fa",
  colorAccent: "#1d5ab5",
  colorDestructive: "#d42222",
  colorBorder: "#d4dce8"
};
const BUILT_IN_THEMES = [
  {
    id: "mlb-classic",
    name: "MLB Classic",
    builtIn: true,
    isDark: false,
    ...DEFAULT_THEME_SEED,
    cssVars: {
      "--background": "210 20% 97%",
      "--foreground": "222 47% 11%",
      "--card": "0 0% 100%",
      "--card-foreground": "222 47% 11%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "222 47% 11%",
      "--primary": "220 65% 25%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "214 32% 91%",
      "--secondary-foreground": "222 47% 11%",
      "--muted": "214 25% 93%",
      "--muted-foreground": "215 16% 50%",
      "--accent": "217 85% 46%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 76% 52%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "214 22% 88%",
      "--input": "214 22% 88%",
      "--ring": "220 65% 25%",
      "--positive": "142 76% 36%",
      "--negative": "0 72% 51%",
      "--warning": "38 92% 50%",
      "--info": "217 91% 60%",
      "--neutral": "215 16% 50%",
      "--scoreboard-accent": "38 92% 55%",
      "--live-pulse": "330 85% 55%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)"
    }
  },
  {
    id: "night-game",
    name: "Night Game",
    builtIn: true,
    isDark: true,
    colorPrimary: "#3a8ef5",
    colorSecondary: "#1e2d40",
    colorBackground: "#0d1724",
    colorAccent: "#5aa4ff",
    colorDestructive: "#e05252",
    colorBorder: "#1f2f45",
    cssVars: {
      "--background": "220 40% 8%",
      "--foreground": "210 35% 94%",
      "--card": "220 35% 12%",
      "--card-foreground": "210 35% 94%",
      "--popover": "220 35% 12%",
      "--popover-foreground": "210 35% 94%",
      "--primary": "214 82% 56%",
      "--primary-foreground": "220 40% 8%",
      "--secondary": "220 28% 18%",
      "--secondary-foreground": "210 35% 94%",
      "--muted": "220 26% 16%",
      "--muted-foreground": "215 18% 62%",
      "--accent": "216 85% 60%",
      "--accent-foreground": "220 40% 8%",
      "--destructive": "0 60% 44%",
      "--destructive-foreground": "210 35% 94%",
      "--border": "220 26% 22%",
      "--input": "220 26% 22%",
      "--ring": "214 82% 56%",
      "--positive": "142 71% 45%",
      "--negative": "0 91% 71%",
      "--warning": "38 92% 60%",
      "--info": "217 91% 70%",
      "--neutral": "215 18% 62%",
      "--scoreboard-accent": "38 92% 62%",
      "--live-pulse": "330 88% 66%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)"
    }
  },
  {
    id: "emerald-diamond",
    name: "Emerald Diamond",
    builtIn: true,
    isDark: false,
    colorPrimary: "#1a5c3a",
    colorSecondary: "#d4eee0",
    colorBackground: "#f3faf6",
    colorAccent: "#287a4d",
    colorDestructive: "#d42222",
    colorBorder: "#cde4d8",
    cssVars: {
      "--background": "140 30% 97%",
      "--foreground": "160 40% 10%",
      "--card": "0 0% 100%",
      "--card-foreground": "160 40% 10%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "160 40% 10%",
      "--primary": "155 55% 22%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "145 30% 90%",
      "--secondary-foreground": "160 40% 10%",
      "--muted": "145 20% 93%",
      "--muted-foreground": "155 15% 50%",
      "--accent": "152 55% 35%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "0 76% 52%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "145 20% 87%",
      "--input": "145 20% 87%",
      "--ring": "155 55% 22%",
      "--positive": "152 55% 35%",
      "--negative": "0 76% 52%",
      "--warning": "38 92% 50%",
      "--info": "217 91% 60%",
      "--neutral": "155 15% 50%",
      "--scoreboard-accent": "36 88% 50%",
      "--live-pulse": "315 75% 50%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)"
    }
  },
  {
    id: "cardinal-red",
    name: "Cardinal Red",
    builtIn: true,
    isDark: false,
    colorPrimary: "#8b1515",
    colorSecondary: "#f5e8e8",
    colorBackground: "#fdf5f5",
    colorAccent: "#b81e1e",
    colorDestructive: "#c85018",
    colorBorder: "#e8d0d0",
    cssVars: {
      "--background": "0 30% 98%",
      "--foreground": "0 40% 10%",
      "--card": "0 0% 100%",
      "--card-foreground": "0 40% 10%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "0 40% 10%",
      "--primary": "355 74% 30%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "0 30% 93%",
      "--secondary-foreground": "0 40% 10%",
      "--muted": "0 22% 95%",
      "--muted-foreground": "0 15% 50%",
      "--accent": "355 74% 38%",
      "--accent-foreground": "0 0% 100%",
      "--destructive": "25 78% 46%",
      "--destructive-foreground": "0 0% 100%",
      "--border": "0 22% 88%",
      "--input": "0 22% 88%",
      "--ring": "355 74% 30%",
      "--positive": "142 76% 36%",
      "--negative": "355 74% 38%",
      "--warning": "38 92% 50%",
      "--info": "217 91% 60%",
      "--neutral": "0 15% 50%",
      "--scoreboard-accent": "34 90% 52%",
      "--live-pulse": "285 70% 58%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)"
    }
  }
];
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
