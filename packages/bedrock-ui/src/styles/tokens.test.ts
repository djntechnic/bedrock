import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "tokens.css"), "utf8");
const count = (needle: string) => css.split(needle).length - 1;

describe("tokens.css shell tokens", () => {
  it("defines --foreground-strong for both the light and dark roots", () => {
    expect(count("--foreground-strong:")).toBe(2);
  });

  it("defines --scrim for both the light and dark roots", () => {
    expect(count("--scrim:")).toBe(2);
  });

  it("maps both tokens into the Tailwind theme", () => {
    expect(css).toContain("--color-foreground-strong: hsl(var(--foreground-strong));");
    expect(css).toContain("--color-scrim: hsl(var(--scrim));");
  });

  it("declares the scroll-thin utility", () => {
    expect(css).toContain("@utility scroll-thin");
  });
});
