/**
 * @file index.ts
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Barrel exports for admin console components.
 */

export { default as ApiSpecPanel, OPENAPI_SPEC_URL, POSTMAN_COLLECTION_URL } from "./ApiSpecPanel";
export type { ApiSpecPanelProps } from "./ApiSpecPanel";

export { default as ApiRoutesPanel, methodColor } from "./ApiRoutesPanel";
export type { ApiRoutesPanelProps } from "./ApiRoutesPanel";

export { default as PlatformHealthPanel, formatBytes } from "./PlatformHealthPanel";
export type { PlatformHealthPanelProps } from "./PlatformHealthPanel";

export { default as ConfigEditor, groupByCategory, boolValue } from "./ConfigEditor";
export { default as LogViewer } from "./LogViewer";
export { default as SecurityLogViewer, PLATFORM_EVENT_TYPES } from "./SecurityLogViewer";
export type { SecurityLogViewerProps } from "./SecurityLogViewer";

export { default as UsersPanel, shortUserAgent } from "./UsersPanel";
export { default as ProfilePage } from "./ProfilePage";
export { default as RoleMatrixPanel } from "./RoleMatrixPanel";
export { default as MenuNavEditorPanel } from "./MenuNavEditorPanel";
export { default as ModulesPanel } from "./ModulesPanel";
export { default as UserAccessProfileView } from "./UserAccessProfileView";
export { default as UserOverridesDrawer } from "./UserOverridesDrawer";
