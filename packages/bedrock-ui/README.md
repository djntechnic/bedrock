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

The package is domain-free by construction: an import-closure check
(`tools/closure_ts.py`) fails the build if a platform module reaches
application code. Anything app-specific arrives through a registry, registered
at boot as an import side-effect:

| Registry | What the app supplies |
| --- | --- |
| `cellRegistry` | Renderers for app-specific `cell_type`s. Unregistered types degrade to plain text — they never throw, because `cell_type` is DB-driven. |
| `rowAccentRegistry` | A row → accent-color resolver. |
| `navRegistry` | The sidebar nav tree. |
| `registerCommandRoutes` | Static command-palette destinations. |
| `searchSourceRegistry` | Entity search groups in the palette. With none registered the palette still works — static routes are the platform's own feature. |
| `apiPreviewRegistry` | Per-grid endpoint bindings the Grid Editor previews against. |
| `datasetSchemas` | Column-name schemas for the editor's unknown-column tripwire. |

## Public API

`src/index.ts` is the contract. Deep imports resolve but are unsupported — if
you need one, it belongs in the barrel.

## Rebuilding from MLBTracker

Until MLBTracker consumes the package, its `frontend/src` remains the source
of truth:

```bash
python tools/extract_ui_from_mlbtracker.py --mlbtracker ../MLBTracker
```

The file set is computed, not listed, so a platform module that grows a
domain import fails the run rather than dragging the domain module along.
