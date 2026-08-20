/**
 * @file ThemeContext.tsx
 * @module frontend/src/context
 * @description React context and provider for light/dark theme state.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Toaster } from "../components/ui/sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemePalette {
  id: string;
  name: string;
  builtIn: boolean;
  isDark: boolean;
  // Six configurable colors (hex strings) — used in admin color pickers and swatches
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorAccent: string;
  colorDestructive: string;
  colorBorder: string;
  // Pre-computed CSS variables for built-in themes (skips derivation step)
  cssVars?: Record<string, string>;
}

/**
 * The reserved id that means "follow the operating system", rather than naming
 * a palette. It is a mode, not a palette: it never appears in `palettes`, and
 * `resolvedThemeId` says which real palette it currently resolves to.
 */
export const SYSTEM_THEME_ID = "system";

interface ThemeContextType {
  /** The user's choice — a palette id, or {@link SYSTEM_THEME_ID}. */
  activeThemeId: string;
  /**
   * The palette actually painted. Equal to `activeThemeId` unless that is
   * `"system"`, in which case it is whichever light/dark palette the OS
   * preference currently selects. A theme picker highlights `activeThemeId`;
   * anything asking "is the UI dark right now" wants this.
   */
  resolvedThemeId: string;
  palettes: ThemePalette[];
  setActiveTheme: (id: string) => void;
  addPalette: (palette: ThemePalette) => void;
  updatePalette: (palette: ThemePalette) => void;
  removePalette: (id: string) => void;
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

function hexToHsl(hex: string): string {
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

function hexLuminance(hex: string): number {
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * toLinear(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * toLinear(parseInt(hex.slice(5, 7), 16))
  );
}

function isDark(hex: string): boolean {
  return hexLuminance(hex) < 0.2;
}

function adjustHex(hex: string, amount: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function fgFor(hex: string): string {
  return isDark(hex) ? "0 0% 100%" : "222 47% 11%";
}

/** Derives the full CSS variable map from the 6 key palette colors. */
function buildCssVars(palette: ThemePalette): Record<string, string> {
  if (palette.cssVars) return palette.cssVars;
  const bgDark = isDark(palette.colorBackground);
  const mutedHex = bgDark
    ? adjustHex(palette.colorBackground, 20)
    : adjustHex(palette.colorBackground, -8);
  const cardHex = bgDark
    ? adjustHex(palette.colorBackground, 12)
    : palette.colorBackground;
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
    "--chart-3": "var(--positive)",
  };
}

/** The full set of §S9 scoreboard token keys every theme surface must define. */
const SCOREBOARD_TOKEN_KEYS = ["--scoreboard-accent", "--live-pulse"] as const;

/** The full set of §S9 chart-role token keys every theme surface must define. */
const CHART_TOKEN_KEYS = ["--chart-1", "--chart-2", "--chart-3"] as const;

/**
 * One-shot migration: a custom theme created before §S9 may carry a frozen
 * `cssVars` snapshot (e.g. imported/patched by a future admin flow) missing
 * the newer scoreboard tokens. Patches them in using the same light/dark
 * defaults as {@link buildCssVars}, leaving themes that already have them —
 * or that have no frozen `cssVars` at all — untouched.
 */
function patchLegacyCssVars(palette: ThemePalette): ThemePalette {
  if (!palette.cssVars) return palette;
  const missingScoreboard = SCOREBOARD_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  const missingChart = CHART_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  if (!missingScoreboard && !missingChart) return palette;
  return {
    ...palette,
    cssVars: {
      "--scoreboard-accent": palette.isDark ? "38 92% 62%" : "38 92% 55%",
      "--live-pulse": palette.isDark ? "330 88% 66%" : "330 85% 55%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)",
      ...palette.cssVars,
    },
  };
}

// ─── Built-in Themes ──────────────────────────────────────────────────────────

/**
 * MLB Classic's 6 raw color fields, shared with `AdminPage.tsx`'s blank
 * custom-theme form default (§S9 §5.2) — a single source so the two never
 * drift out of sync again.
 */
export const DEFAULT_THEME_SEED: Pick<
  ThemePalette,
  "colorPrimary" | "colorSecondary" | "colorBackground" | "colorAccent" | "colorDestructive" | "colorBorder"
> = {
  colorPrimary: "#1e3a82",
  colorSecondary: "#d8e4f0",
  colorBackground: "#f5f8fa",
  colorAccent: "#1d5ab5",
  colorDestructive: "#d42222",
  colorBorder: "#d4dce8",
};

export const BUILT_IN_THEMES: ThemePalette[] = [
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
      "--chart-3": "var(--positive)",
    },
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
      "--chart-3": "var(--positive)",
    },
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
      "--chart-3": "var(--positive)",
    },
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
      "--chart-3": "var(--positive)",
    },
  },
];

// ─── Context & Provider ───────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | null>(null);

const ACTIVE_KEY = "mlbtracker-theme";
const CUSTOM_KEY = "mlbtracker-custom-palettes";

/** Applies a palette's CSS vars to document.documentElement and toggles .dark. */
function applyTheme(palette: ThemePalette) {
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

/**
 * Which palette "system" means, given the OS preference of the moment.
 *
 * Pure and exported so the rule can be tested without a `matchMedia` stub, and
 * so a host can ask the same question the provider asks.
 *
 * §S9 note: this only ever *selects* a registered palette. It defines no
 * colour of its own — a system mode that invented a light theme for a host
 * that ships only dark ones would be exactly the `:root` block the standard
 * forbids, arrived at by another route.
 *
 * @param palettes - Every registered palette, built-in and custom.
 * @param prefersDark - Whether the OS currently asks for dark.
 * @param prefs - The host's nominated light/dark palette ids, if any.
 * @returns The palette to paint, or null when nothing matches.
 */
export function resolveSystemPalette(
  palettes: ThemePalette[],
  prefersDark: boolean,
  prefs: { systemLight?: string; systemDark?: string } = {},
): ThemePalette | null {
  const wanted = prefersDark ? prefs.systemDark : prefs.systemLight;
  const named = wanted ? palettes.find((p) => p.id === wanted) : undefined;
  if (named) return named;
  // No nomination, or it names a palette that has since been deleted: fall
  // back to the first palette of the right polarity. Custom palettes sort
  // after the built-ins, so an unconfigured host gets a built-in.
  const byPolarity = palettes.find((p) => p.isDark === prefersDark);
  if (byPolarity) return byPolarity;
  // A host that registered only dark palettes and whose user asks for light
  // gets its dark theme rather than an unstyled page.
  return palettes[0] ?? null;
}

/** Reads the OS preference, tolerating an environment without `matchMedia`. */
function prefersDarkNow(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

interface ThemeProviderProps {
  children: ReactNode;
  /**
   * The palette `"system"` resolves to when the OS asks for light. A host that
   * ships its own palettes names one here; otherwise the first registered
   * light palette is used, which for an unconfigured host is a built-in.
   */
  systemLight?: string;
  /** The palette `"system"` resolves to when the OS asks for dark. */
  systemDark?: string;
  /**
   * Mount the platform's toast surface. On by default, because `toast()` is
   * called from four platform components and used to do nothing at all — a
   * host had to know to render a `<Toaster>` that the platform never told it
   * about. Set `false` only if the host owns its own notification surface.
   */
  toaster?: boolean;
}

export function ThemeProvider({
  children,
  systemLight,
  systemDark,
  toaster = true,
}: ThemeProviderProps) {
  const [activeThemeId, setActiveThemeId] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) ?? "mlb-classic"
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(prefersDarkNow);

  // Kept live rather than read once at mount: the whole point of system mode
  // is that the page follows the OS while it is open, not only when it loads.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [customPalettes, setCustomPalettes] = useState<ThemePalette[]>(() => {
    let stored: ThemePalette[];
    try {
      stored = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
    } catch {
      return [];
    }
    // One-shot §S9 migration — patch any frozen custom-theme cssVars missing
    // the newer scoreboard tokens, then persist so this only runs once.
    const patched = stored.map(patchLegacyCssVars);
    if (patched.some((p, i) => p !== stored[i])) {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(patched));
    }
    return patched;
  });

  const palettes = [...BUILT_IN_THEMES, ...customPalettes];

  const resolved =
    (activeThemeId === SYSTEM_THEME_ID
      ? resolveSystemPalette(palettes, prefersDark, { systemLight, systemDark })
      : palettes.find((p) => p.id === activeThemeId)) ?? BUILT_IN_THEMES[0];

  useEffect(() => {
    applyTheme(resolved);
    // The *choice* is persisted, not the resolution — storing the resolved id
    // would freeze a system-mode user onto whichever palette they last had.
    localStorage.setItem(ACTIVE_KEY, activeThemeId);
  }, [activeThemeId, resolved]);

  function setActiveTheme(id: string) {
    setActiveThemeId(id);
  }

  function addPalette(palette: ThemePalette) {
    const next = [...customPalettes, palette];
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }

  function updatePalette(palette: ThemePalette) {
    const next = customPalettes.map((p) => (p.id === palette.id ? palette : p));
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  }

  function removePalette(id: string) {
    const next = customPalettes.filter((p) => p.id !== id);
    setCustomPalettes(next);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    if (activeThemeId === id) setActiveThemeId("mlb-classic");
  }

  return (
    <ThemeContext.Provider
      value={{
        activeThemeId,
        resolvedThemeId: resolved.id,
        palettes,
        setActiveTheme,
        addPalette,
        updatePalette,
        removePalette,
      }}
    >
      {children}
      {/* Inside the provider so it repaints with the palette, and after the
          children so it layers over them without needing a z-index of its own. */}
      {toaster && <Toaster isDark={resolved.isDark} />}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
