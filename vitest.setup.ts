/**
 * @file vitest.setup.ts
 * @description Global test setup: jest-dom matchers, and a DOM teardown
 *              between tests so one test's rendered tree cannot be found by
 *              the next one's query.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
