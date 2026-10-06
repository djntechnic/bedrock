import { describe, expect, it } from "vitest";
import {
  BUILT_IN_THEMES,
  buildCssVars,
  patchLegacyCssVars,
  type ThemePalette,
} from "./ThemeContext";

const HSL_TRIPLET = /^\d+ \d+% \d+%$/;

/** A user-made theme: the six colours of a built-in, and no stored snapshot. */
function derivedFrom(id: string): ThemePalette {
  const source = BUILT_IN_THEMES.find((theme) => theme.id === id);
  if (!source) throw new Error(`no built-in theme "${id}"`);
  return {
    id: `custom-${id}`,
    name: `Custom ${source.name}`,
    builtIn: false,
    isDark: source.isDark,
    colorPrimary: source.colorPrimary,
    colorSecondary: source.colorSecondary,
    colorBackground: source.colorBackground,
    colorAccent: source.colorAccent,
    colorDestructive: source.colorDestructive,
    colorBorder: source.colorBorder,
  };
}

describe("shell tokens across theme surfaces", () => {
  it("ships both tokens in every built-in theme", () => {
    for (const theme of BUILT_IN_THEMES) {
      const vars = buildCssVars(theme);
      expect(vars["--foreground-strong"], theme.id).toMatch(HSL_TRIPLET);
      expect(vars["--scrim"], theme.id).toMatch(HSL_TRIPLET);
    }
  });

  it("derives a strong foreground from the primary on a light custom theme", () => {
    const vars = buildCssVars(derivedFrom("mlb-classic"));
    expect(vars["--foreground-strong"]).toBe(vars["--primary"]);
    expect(vars["--scrim"]).toBe("222 47% 11%");
  });

  it("derives a near-white strong foreground on a dark custom theme", () => {
    const vars = buildCssVars(derivedFrom("night-game"));
    expect(vars["--foreground-strong"]).toBe("210 40% 98%");
    expect(vars["--scrim"]).toBe("220 40% 4%");
  });

  it("backfills the shell tokens into a frozen legacy snapshot", () => {
    const legacy: ThemePalette = {
      ...derivedFrom("mlb-classic"),
      cssVars: { "--primary": "200 50% 30%" },
    };
    const patched = patchLegacyCssVars(legacy);
    expect(patched.cssVars?.["--foreground-strong"]).toBe("200 50% 30%");
    expect(patched.cssVars?.["--scrim"]).toBe("222 47% 11%");
    expect(patched.cssVars?.["--primary"]).toBe("200 50% 30%");
  });

  it("leaves an already-patched snapshot untouched", () => {
    const legacy: ThemePalette = {
      ...derivedFrom("mlb-classic"),
      cssVars: { "--primary": "200 50% 30%" },
    };
    const once = patchLegacyCssVars(legacy);
    expect(patchLegacyCssVars(once)).toBe(once);
  });
});
