/**
 * @file vitest.workspace.ts
 * @description Multi-project Vitest workspace for the bedrock monorepo.
 *
 * A single `vitest.config.ts` was enough while `@djntechnic/bedrock-ui` was
 * the only package with tests. `run_qa.py`'s `scoped`/`full` tiers need to
 * name and run "the frontend project(s)" as a unit — `vitest related` and
 * per-project reporting both key off workspace project names — so this file
 * is the seam a second frontend package plugs into without touching
 * `run_qa.py`.
 *
 * It lives at the repository root for the same reason `vitest.config.ts`
 * does: the npm manifest is at the root, and both need to agree about where
 * `node_modules` is (see v0.1.1 in CHANGELOG.md).
 */
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "bedrock-ui",
      root: ".",
      include: ["packages/bedrock-ui/src/**/*.test.{ts,tsx}"],
    },
  },
]);
