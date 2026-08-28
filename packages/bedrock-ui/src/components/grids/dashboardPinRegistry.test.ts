/**
 * @file dashboardPinRegistry.test.ts
 * @description Cover for the dashboard-pin host registration (#36).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  __clearDashboardPinHost,
  hasDashboardPinHost,
  registerDashboardPinHost,
} from "./dashboardPinRegistry";

beforeEach(() => {
  __clearDashboardPinHost();
});

describe("dashboardPinRegistry", () => {
  it("reports no host until one registers", () => {
    // The default matters more than the registered case: an app that has not
    // built a dashboard gets the pin controls hidden without doing anything.
    expect(hasDashboardPinHost()).toBe(false);
  });

  it("reports a host once the app declares one", () => {
    registerDashboardPinHost();
    expect(hasDashboardPinHost()).toBe(true);
  });

  it("stays registered across repeated reads", () => {
    // Reads happen on every grid render; registration is a boot-time
    // side-effect that must not be consumed by the first reader.
    registerDashboardPinHost();
    expect(hasDashboardPinHost()).toBe(true);
    expect(hasDashboardPinHost()).toBe(true);
  });

  it("is idempotent", () => {
    // Two entry points calling it is a plausible host mistake, not an error.
    registerDashboardPinHost();
    registerDashboardPinHost();
    expect(hasDashboardPinHost()).toBe(true);
  });

  it("can be cleared, for tests", () => {
    registerDashboardPinHost();
    __clearDashboardPinHost();
    expect(hasDashboardPinHost()).toBe(false);
  });
});
