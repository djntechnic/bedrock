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

// ── jsdom gaps that Radix relies on ──────────────────────────────────────────
//
// Radix's Select, Dialog and Popover call these during a pointer interaction.
// jsdom implements neither the Pointer Capture API nor layout, so opening a
// Select in a test throws `target.hasPointerCapture is not a function` and the
// listbox never renders — a failure that looks like a missing option and is
// actually a missing browser API.
//
// Stubbed rather than worked around at each call site: every future test that
// touches one of these primitives needs it, and `userEvent.click` on the real
// trigger is the interaction worth testing.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
