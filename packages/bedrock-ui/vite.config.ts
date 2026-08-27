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
 */
import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

export default defineConfig({
  build: {
    outDir: resolve(here, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    minify: false,
    lib: {
      entry: resolve(here, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external,
      output: {
        // One `.js` per source module, at the same relative path the `.d.ts`
        // for it lands on. `lib.fileName` still names the barrel: `src/index.ts`
        // is the entry, so it emits as `dist/index.js`.
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
