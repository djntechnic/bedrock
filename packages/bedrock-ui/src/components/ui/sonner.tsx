/**
 * @file sonner.tsx
 * @module frontend/src/components/ui
 * @description The platform's toast surface.
 *
 * `sonner` has been a declared dependency all along, and four platform
 * components already call `toast()` — a CSV export, two grid-editor saves and a
 * rejected cell commit. None of them displayed anything, because nothing ever
 * rendered a `<Toaster>`. The calls succeeded and the operator was told
 * nothing, on paths that include the one that loses work.
 */
import { Toaster as Sonner, type ToasterProps } from "sonner";

export interface PlatformToasterProps extends Omit<ToasterProps, "theme"> {
  /**
   * Polarity of the palette currently painted.
   *
   * Passed in rather than read from `useTheme()` on purpose: `ThemeProvider`
   * is what mounts this, and a context read here would close an import cycle
   * between the provider and its own child.
   */
  isDark?: boolean;
}

/**
 * Sonner's `<Toaster>` with the platform's defaults and its light/dark mode
 * taken from the palette that is actually on screen.
 */
export function Toaster({ isDark = false, ...props }: PlatformToasterProps) {
  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
      {...props}
    />
  );
}
