/**
 * @file packages/bedrock-ui/vite.config.ts
 * @description Library build for `@djntechnic/bedrock-ui`.
 *
 * The package used to ship raw TypeScript. That forced every consumer to put it
 * in `optimizeDeps.exclude`, and an excluded dependency is one Vite never
 * crawls — so the package's own transitive CommonJS dependencies (`pino` via
 * its `browser` field, `use-sync-external-store/shim/with-selector.js` behind
 * zustand) were served raw to the browser, where a CJS module cannot be
 * default-imported as ESM. Each consumer re-derived the same
 * `optimizeDeps.include` list by trial and error, one throw at a time.
 *
 * Building here fixes that at the source: Rollup resolves those interop
 * problems once, at publish time, and the consumer receives plain ESM it can
 * pre-bundle like any other dependency.
 *
 * `peerDependencies` are external by construction — the consumer owns those
 * copies, and bundling React or `@tanstack/react-query` in here would give the
 * app two of them. Everything else the source imports is inlined.
 *
 * The build emits one `.js` per source module rather than a single bundle
 * (`preserveModules`). The package's `exports` map advertises `"./*"`, so a
 * consumer may import any module by its source-relative path —
 * `@djntechnic/bedrock-ui/hooks/useAdminPlatform`, and 85 more of them in
 * MLBTracker alone. A single-file bundle satisfies the barrel entry and nothing
 * else: every one of those subpaths resolves to a file that was never written.
 * Per-module output makes the runtime layout match the `.d.ts` layout
 * `build:types` already emits, so a subpath's types and its code sit side by
 * side.
 *
 * Every source module is its own entry, not just the barrel. `preserveModules`
 * decides where a module's code *lands*; it does not decide what that module
 * still exports. With `src/index.ts` as the sole entry, Rollup is free to drop
 * any export the barrel's graph never reaches — and it did, silently, for
 * `renderRankCell` and `useRowClickHandler`. The `.d.ts` kept declaring them,
 * because `tsc` shakes nothing, so a consumer's type check passed and the
 * import threw at runtime. Treating each module as an entry makes its public
 * surface load-bearing, which is what the `"./*"` export map already claims.
 */
import { defineConfig } from "vite";
import { dirname, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as {
  peerDependencies?: Record<string, string>;
};

const peers = Object.keys(pkg.peerDependencies ?? {});

/**
 * A peer is external for its bare name and for every subpath under it —
 * `react-dom/client` and `radix-ui/…` must not be bundled just because they are
 * not the exact package name.
 */
const external = (id: string) =>
  peers.some((peer) => id === peer || id.startsWith(`${peer}/`));

const src = resolve(here, "src");

/**
 * Every module a consumer may import — which, given `"./*"`, is every module
 * under `src`. Tests and test-only helpers are excluded: they are not part of
 * the published surface and pull `vitest` into the graph.
 */
function entries(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === "test" || item.name === "__tests__") continue;
      Object.assign(out, entries(full));
      continue;
    }
    if (!/\.tsx?$/.test(item.name)) continue;
    if (/\.(test|spec)\.tsx?$/.test(item.name)) continue;
    if (item.name.endsWith(".d.ts")) continue;
    // Keyed by the path the `.d.ts` for it lands on, so `entryFileNames`
    // reproduces the source tree exactly.
    const name = relative(src, full).replace(/\\/g, "/").replace(/\.tsx?$/, "");
    out[name] = full;
  }
  return out;
}

export default defineConfig({
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    minify: false,
    lib: {
      entry: entries(src),
      formats: ["es"],
      // `entryFileNames` below is what actually names the files; this keeps
      // Vite's own validation happy for a multi-entry lib build.
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external,
      output: {
        // One `.js` per source module, at the same relative path the `.d.ts`
        // for it lands on. Entry names are already source-relative, so
        // `[name].js` reproduces the tree — `src/index.ts` emits as
        // `dist/index.js`.
        preserveModules: true,
        preserveModulesRoot: resolve(here, "src"),
        entryFileNames: "[name].js",
        // A bundled (non-peer) dependency has no path under `src`; give it a
        // stable home instead of letting it collide with a source module name.
        chunkFileNames: "_vendor/[name].js",
        // Keep CSS (if any is ever added) at a predictable name rather than a
        // hashed one, so the `exports` map can address it.
        assetFileNames: "[name][extname]",
      },
    },
  },
});
