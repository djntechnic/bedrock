/**
 * @file palettes.ts
 * @module @djntechnic/bedrock-ui/theme
 * @description Raw color source-of-truth for the built-in themes (§S009 —
 * this is the file `bedrock.toml`'s `[tool.bedrock.audit.s009] theme_palettes`
 * points at). Every other module derives or consumes tokens; this is where
 * the six raw swatch hexes and each theme's pre-computed CSS variable map
 * are allowed to exist as literals.
 */
import type { ThemePalette } from "../context/ThemeContext";
/**
 * MLB Classic's 6 raw color fields, shared with `AdminPage.tsx`'s blank
 * custom-theme form default (§S009 §5.2) — a single source so the two never
 * drift out of sync again.
 */
export declare const DEFAULT_THEME_SEED: Pick<ThemePalette, "colorPrimary" | "colorSecondary" | "colorBackground" | "colorAccent" | "colorDestructive" | "colorBorder">;
export declare const BUILT_IN_THEMES: ThemePalette[];
