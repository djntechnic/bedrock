/**
 * @file packages/bedrock-ui/src/packaging.test.ts
 * @description Guards the shape of the published `dist` against the `exports`
 * map that advertises it.
 *
 * v0.6.0 shipped a build that emitted a single `index.js` bundle while the root
 * `package.json` advertised `"./*"` — so `@djntechnic/bedrock-ui/hooks/useAuth`
 * and the eighty-odd other deep imports consumers already had resolved to files
 * that were never written. Nothing here caught it: bedrock's own tests import
 * from `src`, and its type check never resolves the package by name. This test
 * is the missing check — it reads the built output, not the source.
 *
 * It requires a built `dist`. CI builds explicitly before running the suite;
 * locally, `npm run build && npm run build:types` first.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist");
const repoRoot = resolve(here, "../../..");

/**
 * Deep subpaths consumers import today, sampled across the export surface
 * (hooks, api, lib, utils, store, components, and a nested component
 * directory). Not exhaustive — MLBTracker alone has 86 — but every entry here
 * is a real import from a real consumer, so a build that breaks any of them
 * breaks that consumer's type check.
 */
const CONSUMER_SUBPATHS = [
  "hooks/useAuth",
  "hooks/useGridConfig",
  "hooks/useUserGridConfig",
  "hooks/useModules",
  "hooks/useAdminPlatform",
  "api/client",
  "lib/logger",
  "utils/logger",
  "store/flyoutStore",
  "components/grids/cellRenderers",
  "components/admin/gridEditor/useGridDraft",
  "components/admin/gridEditor/GridColumnsPanel",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe("published package layout", () => {
  const built = existsSync(join(dist, "index.js"));

  it("has a built dist to check", () => {
    expect(
      built,
      "dist/index.js is missing — run `npm run build && npm run build:types`",
    ).toBe(true);
  });

  if (!built) return;

  const files = walk(dist).map((f) => relative(dist, f).replace(/\\/g, "/"));
  const js = files.filter((f) => f.endsWith(".js"));
  const dts = new Set(files.filter((f) => f.endsWith(".d.ts")));

  it("emits one module per source file, not a single bundle", () => {
    // The regression this file exists for produced exactly one.
    expect(js.length).toBeGreaterThan(1);
  });

  it("puts a .d.ts beside every emitted .js", () => {
    const orphans = js.filter((f) => !dts.has(f.replace(/\.js$/, ".d.ts")));
    expect(orphans).toEqual([]);
  });

  it.each(CONSUMER_SUBPATHS)("resolves the subpath %s", (subpath) => {
    expect(existsSync(join(dist, `${subpath}.js`))).toBe(true);
    expect(existsSync(join(dist, `${subpath}.d.ts`))).toBe(true);
  });

  it("advertises subpaths with the extensions the build emits", () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf-8"),
    ) as { exports: Record<string, unknown> };
    // Consumers import without an extension; the wildcard target has to supply
    // it, or Node and TypeScript both look for a file with no suffix.
    expect(pkg.exports["./*"]).toEqual({
      types: "./packages/bedrock-ui/dist/*.d.ts",
      import: "./packages/bedrock-ui/dist/*.js",
    });
  });
});
