/**
 * @file storageMigration.test.ts
 * @description The platform's localStorage keys carry no consumer's name; a
 *              value stored under the old `mlbtracker-*` key is carried over.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The stores read storage once, when the module loads, so each case sets up
// storage first and imports afterwards.
async function loadSidebar() {
  vi.resetModules();
  return (await import("./sidebarStore")).useSidebarStore;
}
async function loadPalette() {
  vi.resetModules();
  return (await import("./commandPaletteStore")).useCommandPaletteStore;
}

describe("platform localStorage keys", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe("sidebarStore", () => {
    it("carries a legacy pinned value forward", async () => {
      localStorage.setItem("mlbtracker-sidebar-pinned", "true");
      const store = await loadSidebar();
      expect(store.getState().pinned).toBe(true);
      expect(localStorage.getItem("bedrock-sidebar-pinned")).toBe("true");
    });

    it("prefers the new key over a legacy one", async () => {
      localStorage.setItem("bedrock-sidebar-pinned", "false");
      localStorage.setItem("mlbtracker-sidebar-pinned", "true");
      const store = await loadSidebar();
      expect(store.getState().pinned).toBe(false);
    });

    it("persists under the new key only", async () => {
      const store = await loadSidebar();
      store.getState().togglePinned();
      expect(localStorage.getItem("bedrock-sidebar-pinned")).toBe("true");
      expect(localStorage.getItem("mlbtracker-sidebar-pinned")).toBeNull();
    });
  });

  describe("commandPaletteStore", () => {
    it("carries legacy recents and pins forward", async () => {
      localStorage.setItem("mlbtracker-command-recents", JSON.stringify(["rec-1"]));
      localStorage.setItem("mlbtracker-command-pinned", JSON.stringify(["pin-1"]));
      const store = await loadPalette();
      expect(store.getState().recentIds).toEqual(["rec-1"]);
      expect(store.getState().pinnedIds).toEqual(["pin-1"]);
      expect(localStorage.getItem("bedrock-command-recents")).toBe('["rec-1"]');
      expect(localStorage.getItem("bedrock-command-pinned")).toBe('["pin-1"]');
    });

    it("writes new entries under the new key only", async () => {
      localStorage.setItem("mlbtracker-command-recents", JSON.stringify(["rec-1"]));
      const store = await loadPalette();
      store.getState().addRecent("rec-2");
      expect(JSON.parse(localStorage.getItem("bedrock-command-recents") ?? "[]")).toEqual([
        "rec-2",
        "rec-1",
      ]);
    });

    it("starts empty when nothing is stored", async () => {
      const store = await loadPalette();
      expect(store.getState().recentIds).toEqual([]);
      expect(store.getState().pinnedIds).toEqual([]);
    });

    it("ignores a malformed legacy value", async () => {
      localStorage.setItem("mlbtracker-command-recents", "{not json");
      const store = await loadPalette();
      expect(store.getState().recentIds).toEqual([]);
    });
  });
});
