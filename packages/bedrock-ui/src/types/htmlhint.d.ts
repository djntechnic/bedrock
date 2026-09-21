/**
 * htmlhint ships its declarations under `dist/core/` but its manifest has no
 * `types` field, so TypeScript cannot find them from the bare specifier.
 * Point the specifier at the real declarations rather than accept an implicit
 * `any` for the whole module.
 */
declare module "htmlhint" {
  export { HTMLHint } from "htmlhint/dist/core/core";
}
