import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appSettings, resolveAppName } from "./index";

declare global {
  interface Window {
    __BEDROCK_APP_NAME__?: string;
  }
}

describe("resolveAppName (#61)", () => {
  const originalWindowVal = typeof window !== "undefined" ? window.__BEDROCK_APP_NAME__ : undefined;

  beforeEach(() => {
    if (typeof window !== "undefined") {
      delete window.__BEDROCK_APP_NAME__;
    }
  });

  afterEach(() => {
    if (typeof window !== "undefined") {
      if (originalWindowVal !== undefined) {
        window.__BEDROCK_APP_NAME__ = originalWindowVal;
      } else {
        delete window.__BEDROCK_APP_NAME__;
      }
    }
  });

  it("resolves window.__BEDROCK_APP_NAME__ when set on window", () => {
    window.__BEDROCK_APP_NAME__ = "MLBTracker";
    expect(resolveAppName()).toBe("MLBTracker");
  });

  it("resolves runtimeConfigAppName when supplied", () => {
    expect(resolveAppName("Custom Runtime App")).toBe("Custom Runtime App");
  });

  it("prefers window.__BEDROCK_APP_NAME__ over runtime config and env var", () => {
    window.__BEDROCK_APP_NAME__ = "Window Override App";
    expect(resolveAppName("Custom Runtime App")).toBe("Window Override App");
  });

  it("falls back to default 'Bedrock' when no runtime window overrides or config exist", () => {
    delete window.__BEDROCK_APP_NAME__;
    const resolved = resolveAppName();
    expect(resolved).toBe("Bedrock");
  });

  it("appSettings.system.appName reflects resolveAppName() dynamically", () => {
    window.__BEDROCK_APP_NAME__ = "Dynamic System Name";
    expect(appSettings.system.appName).toBe("Dynamic System Name");
  });
});
