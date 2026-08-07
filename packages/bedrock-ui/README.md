# @djntechnic/bedrock-ui

The reusable React half of the bedrock platform: a config-driven grid engine,
the admin Grid Editor, the app shell, auth wiring, and the design-token
contract. Extracted from MLBTracker; MLBTracker is its first consumer.

## Ships TypeScript source, not build output

Deliberate. The components are Tailwind-based and token-driven, so a consumer
compiles them with their own `tsconfig` and their own Tailwind build. That
sidesteps CSS bundling, token baking, and maintaining a dual build entirely.

Two consequences:

- Tailwind must scan the package. In your `index.css`:
  ```css
  @source "../node_modules/@djntechnic/bedrock-ui/src";
  ```
- Your bundler must transpile it. Vite does by default for linked/workspace
  packages; for a git dependency you may need `optimizeDeps.exclude`.

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

`src/index.ts` is the contract. Deep imports resolve but are unsupported — if
you need one, it belongs in the barrel.

## Provenance

These files were extracted from MLBTracker by computing the transitive import
closure of the platform's entry points — a list nobody wrote, so nothing could
be left off it by accident. The extraction scripts lived in `tools/` through
v0.1.0 and were removed once MLBTracker began consuming the package: with the
app downstream, re-deriving these files *from* the app is backwards, and a
re-run would silently revert any fix made here. They remain in git history if
the closure ever needs recomputing.
