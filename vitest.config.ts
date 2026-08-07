/**
 * @file vitest.config.ts
 * @description Test runner for `@djntechnic/bedrock-ui`.
 *
 * The package shipped with a type check and nothing else — `tsc --noEmit` will
 * tell you a prop is misspelled and nothing at all about whether a form
 * submits. This adds the runner; F1's flow pages are its first subject.
 *
 * It lives at the repository root because the npm manifest does (see v0.1.1:
 * npm cannot install a package from a subdirectory), and the two need to agree
 * about where `node_modules` is.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/bedrock-ui/src/**/*.test.{ts,tsx}"],
  },
});
