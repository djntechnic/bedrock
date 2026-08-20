/**
 * @file ThemeContext.test.tsx
 * @description Cover for the System theme mode.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  ThemeProvider,
  useTheme,
  resolveSystemPalette,
  SYSTEM_THEME_ID,
  BUILT_IN_THEMES,
  type ThemePalette,
} from "./ThemeContext";

const light = (id: string): ThemePalette => ({
  id,
  name: id,
  builtIn: false,
  isDark: false,
  colorPrimary: "#112233",
  colorSecondary: "#445566",
  colorBackground: "#ffffff",
  colorAccent: "#778899",
  colorDestructive: "#aa1122",
  colorBorder: "#cccccc",
});
const dark = (id: string): ThemePalette => ({ ...light(id), isDark: true, colorBackground: "#101010" });

describe("resolveSystemPalette", () => {
  const palettes = [light("l1"), dark("d1"), light("l2"), dark("d2")];

  it("honours the host's nominated palette for each polarity", () => {
    expect(resolveSystemPalette(palettes, true, { systemLight: "l2", systemDark: "d2" })!.id).toBe("d2");
    expect(resolveSystemPalette(palettes, false, { systemLight: "l2", systemDark: "d2" })!.id).toBe("l2");
  });

  it("falls back to the first palette of the right polarity when unconfigured", () => {
    expect(resolveSystemPalette(palettes, true)!.id).toBe("d1");
    expect(resolveSystemPalette(palettes, false)!.id).toBe("l1");
  });

  it("falls back when the nomination names a palette that has been deleted", () => {
    // A host can nominate a custom palette and the user can then remove it.
    expect(resolveSystemPalette(palettes, true, { systemDark: "gone" })!.id).toBe("d1");
  });

  it("gives a single-polarity host its own theme rather than nothing", () => {
    expect(resolveSystemPalette([dark("only")], false)!.id).toBe("only");
  });

  it("returns null when there is nothing to resolve to", () => {
    expect(resolveSystemPalette([], true)).toBeNull();
  });
});

// ─── Provider ────────────────────────────────────────────────────────────────

/** A controllable `prefers-color-scheme` stub. */
function stubMatchMedia(initialDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = initialDark;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    })),
  );
  return {
    set(next: boolean) {
      matches = next;
      act(() => {
        listeners.forEach((fn) => fn({ matches: next } as MediaQueryListEvent));
      });
    },
  };
}

function Probe() {
  const { activeThemeId, resolvedThemeId } = useTheme();
  return (
    <span data-testid="probe">
      {activeThemeId}|{resolvedThemeId}
    </span>
  );
}

const probe = () => screen.getByTestId("probe").textContent;
const lightPalette = BUILT_IN_THEMES.find((p) => !p.isDark)!;
const darkPalette = BUILT_IN_THEMES.find((p) => p.isDark)!;

describe("ThemeProvider system mode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it("paints the dark palette when the OS asks for dark", () => {
    stubMatchMedia(true);
    localStorage.setItem("mlbtracker-theme", SYSTEM_THEME_ID);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toBe(`${SYSTEM_THEME_ID}|${darkPalette.id}`);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows the OS while the page is open, not only at load", () => {
    // The behaviour that separates a system mode from a one-time guess.
    const mq = stubMatchMedia(false);
    localStorage.setItem("mlbtracker-theme", SYSTEM_THEME_ID);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toBe(`${SYSTEM_THEME_ID}|${lightPalette.id}`);
    mq.set(true);
    expect(probe()).toBe(`${SYSTEM_THEME_ID}|${darkPalette.id}`);
  });

  it("persists the choice, not the palette it resolved to", () => {
    // Storing the resolution would strand a system-mode user on whichever
    // palette the OS happened to want when they last had the page open.
    stubMatchMedia(true);
    localStorage.setItem("mlbtracker-theme", SYSTEM_THEME_ID);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(localStorage.getItem("mlbtracker-theme")).toBe(SYSTEM_THEME_ID);
  });

  it("leaves an explicit choice alone whatever the OS prefers", () => {
    stubMatchMedia(true);
    localStorage.setItem("mlbtracker-theme", lightPalette.id);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toBe(`${lightPalette.id}|${lightPalette.id}`);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("uses the host's nominated palettes when it names them", () => {
    stubMatchMedia(false);
    localStorage.setItem("mlbtracker-theme", SYSTEM_THEME_ID);
    const otherLight = BUILT_IN_THEMES.filter((p) => !p.isDark)[1]!;
    render(
      <ThemeProvider systemLight={otherLight.id} systemDark={darkPalette.id}>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toBe(`${SYSTEM_THEME_ID}|${otherLight.id}`);
  });

  it("renders without a matchMedia at all", () => {
    // jsdom-shaped environments and SSR both lack it; the provider must not
    // take the whole shell down over an appearance preference.
    vi.stubGlobal("matchMedia", undefined);
    localStorage.setItem("mlbtracker-theme", SYSTEM_THEME_ID);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toBe(`${SYSTEM_THEME_ID}|${lightPalette.id}`);
  });
});
