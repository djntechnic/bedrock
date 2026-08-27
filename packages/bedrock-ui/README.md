# @djntechnic/bedrock-ui

The reusable React half of the bedrock platform: a config-driven grid engine,
the admin Grid Editor, the app shell, auth wiring, and the design-token
contract. Extracted from MLBTracker; MLBTracker is its first consumer.

## Ships built ESM, not TypeScript source

`exports["."]` resolves to `dist/index.js` (plus `dist/index.d.ts` for types) —
a Vite library build, not the `.ts`/`.tsx` sources. Consumers no longer
transpile this package themselves, and it no longer needs
`optimizeDeps.exclude`.

Two things this still leaves you to do:

- Tailwind must scan the package's *source* for class names, since styling is
  token-driven and the Tailwind build itself still happens downstream. In your
  `index.css`:
  ```css
  @source "../node_modules/@djntechnic/bedrock-ui/src";
  ```
- `dist/index.d.ts` is the only in-repo type surface; deep `.tsx` imports for
  application code were never supported (see Public API below), and are even
  less useful now that `./*` resolves into `dist`, where only declarations
  exist per-file.

### `prepare` builds on every install

The `prepare` script runs `build` and `build:types`, which need `vite` and
`typescript` from `devDependencies`. That means `npm ci --omit=dev` against
this repository fails — there's nothing that runs the build. This is
deliberate, not an oversight: consumers install over `github:`/`git+https`,
where there is no publish step and no prebuilt artifact to fetch. Without
`prepare` running the build on install, a `git` dependency would ship an empty
`dist` and nothing would work. If you need a `--omit=dev`-safe install of this
package specifically, build it out-of-band first and vendor the result — don't
try to make the install itself dev-dependency-free.

### Removing `optimizeDeps.exclude` — drop `include` in the same change

If your app's Vite config still has `@djntechnic/bedrock-ui` in
`optimizeDeps.exclude` (left over from when this package shipped source),
remove it. But remove any `optimizeDeps.include` entries that were added
*because of* that exclude — `pino`, `use-sync-external-store/shim/with-selector.js`,
and similar — in the **same** change. An excluded dependency is one Vite never
crawls, so none of its transitive CommonJS dependencies get pre-bundled either;
that's what the `include` entries were compensating for. Drop only `exclude`
and keep `include` and the app looks like it regressed — it throws on the
first uncrawled CJS peer just as before, because `exclude` alone is what causes
that, independent of anything this package ships. The two lists come out
together or not at all.

## Install

```jsonc
// package.json
"dependencies": {
  "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.1.0"
}
```

Peer dependencies are pinned to the versions MLBTracker actually runs, which
is the only combination known to work. Note `zustand` is v4, not v5.

## Tokens

```css
@import "@djntechnic/bedrock-ui/styles/tokens.css";
```

Every color in every component resolves through these variables (§S9), so
restyling happens by overriding values and keeping the names — not by forking
components. `:root` is the light theme, `.dark` the dark one.

## Extension points

The package's file set was derived as an import closure of the platform's
entry points, so no module here can reach application code. Anything
app-specific arrives through a registry, registered at boot as an import
side-effect:

| Registry | What the app supplies |
| --- | --- |
| `cellRegistry` | Renderers for app-specific `cell_type`s. Unregistered types degrade to plain text — they never throw, because `cell_type` is DB-driven. |
| `rowAccentRegistry` | A row → accent-color resolver. |
| `navRegistry` | The sidebar nav tree. |
| `registerCommandRoutes` | Static command-palette destinations. |
| `searchSourceRegistry` | Entity search groups in the palette. With none registered the palette still works — static routes are the platform's own feature. |
| `apiPreviewRegistry` | Per-grid endpoint bindings the Grid Editor previews against. |
| `datasetSchemas` | Column-name schemas for the editor's unknown-column tripwire. |

## Where the manifest lives

`package.json` is at the **repository root**, not in this directory, and its
`exports` map points back down here. That is not tidiness — npm cannot install
a package from a subdirectory of a git repository, so a manifest sitting in
`packages/bedrock-ui/` is unreachable by `github:djntechnic/bedrock#<ref>`.
(pip has no such limitation, which is why `bedrock-api` keeps its
`pyproject.toml` in place and is installed with `#subdirectory=`.)

The source still lives here. Only the manifest moved.

## Public API

`src/index.ts` is the contract. Deep imports resolve, via the `./*` export,
but are unsupported for application code — if an app needs one, it belongs in
the barrel.

The one standing exception is a white-box test of a package internal. Those
tests should live in this repository rather than in a consumer's, and until
they move here they reach their subject by deep import instead of forcing a
private component into the public API to make a test compile.

## Provenance

These files were extracted from MLBTracker by computing the transitive import
closure of the platform's entry points — a list nobody wrote, so nothing could
be left off it by accident. The extraction scripts lived in `tools/` through
v0.1.0 and were removed once MLBTracker began consuming the package: with the
app downstream, re-deriving these files *from* the app is backwards, and a
re-run would silently revert any fix made here. They remain in git history if
the closure ever needs recomputing.
