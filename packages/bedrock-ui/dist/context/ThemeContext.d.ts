/**
 * @file ThemeContext.tsx
 * @module frontend/src/context
 * @description React context and provider for light/dark theme state.
 */
import { type ReactNode } from "react";
export interface ThemePalette {
    id: string;
    name: string;
    builtIn: boolean;
    isDark: boolean;
    colorPrimary: string;
    colorSecondary: string;
    colorBackground: string;
    colorAccent: string;
    colorDestructive: string;
    colorBorder: string;
    cssVars?: Record<string, string>;
}
/**
 * The reserved id that means "follow the operating system", rather than naming
 * a palette. It is a mode, not a palette: it never appears in `palettes`, and
 * `resolvedThemeId` says which real palette it currently resolves to.
 */
export declare const SYSTEM_THEME_ID = "system";
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
/**
 * MLB Classic's 6 raw color fields, shared with `AdminPage.tsx`'s blank
 * custom-theme form default (§S9 §5.2) — a single source so the two never
 * drift out of sync again.
 */
export declare const DEFAULT_THEME_SEED: Pick<ThemePalette, "colorPrimary" | "colorSecondary" | "colorBackground" | "colorAccent" | "colorDestructive" | "colorBorder">;
export declare const BUILT_IN_THEMES: ThemePalette[];
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
export declare function resolveSystemPalette(palettes: ThemePalette[], prefersDark: boolean, prefs?: {
    systemLight?: string;
    systemDark?: string;
}): ThemePalette | null;
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
export declare function ThemeProvider({ children, systemLight, systemDark, toaster, }: ThemeProviderProps): import("react").JSX.Element;
export declare function useTheme(): ThemeContextType;
export {};
