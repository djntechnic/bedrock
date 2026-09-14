/**
 * @file gridMocks.ts
 * @module @djntechnic/bedrock-ui/test
 * @description Shared mock factories for grid configuration used across grid tests.
 */
import type { GridConfig } from "../hooks/useGridConfig";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";
/** Builds a minimal default GridConfig suitable for tests. */
export declare function makeGridConfig(overrides?: Partial<GridConfig>): GridConfig;
/** Builds a minimal column setting for use in column maps. */
export declare function makeColumnSetting(overrides?: Partial<GridColumnSetting>): GridColumnSetting;
