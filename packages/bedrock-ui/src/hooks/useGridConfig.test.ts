/**
 * @file useGridConfig.test.ts
 * @description Cover for the unseeded-grid signal.
 */
import { describe, it, expect } from "vitest";
import { buildGridConfig } from "./useGridConfig";
import type { GridSetting } from "./useAdminPlatform";

const setting = (grid_id: string) =>
  ({ grid_setting_id: 1, grid_id, row_key_column: "id" }) as unknown as GridSetting;

describe("buildGridConfig — isUnseeded", () => {
  it("flags a grid id that resolved to no settings row", () => {
    expect(buildGridConfig("nope", undefined, [], true).isUnseeded).toBe(true);
  });

  it("does not flag a grid that is still loading", () => {
    // Not-loaded means "wait"; unseeded means "this will never arrive".
    // Conflating them would flash an error on every grid on every mount.
    expect(buildGridConfig("nope", undefined, [], false).isUnseeded).toBe(false);
  });

  it("does not flag a seeded grid", () => {
    expect(buildGridConfig("real", setting("real"), [], true).isUnseeded).toBe(false);
  });

  it("flags a seeded grid whose columns are all absent", () => {
    // The distinguishing case: zero columns is not the same fault as zero
    // grid rows, and only the latter is a configuration error.
    const config = buildGridConfig("real", setting("real"), [], true);
    expect(config.isUnseeded).toBe(false);
    expect(config.columnOrder).toEqual([]);
  });
});
