/**
 * @file index.ts
 * @module @djntechnic/bedrock-ui
 * @description Public API surface.
 *
 * What is exported here is the contract; what is not is internal, and may
 * change in a patch release. Deep imports (`@djntechnic/bedrock-ui/components/…`)
 * are possible but unsupported — if you need one, it belongs in this barrel.
 */

// ── Grid engine ──────────────────────────────────────────────────────────────
export { default as DataGrid } from "./components/grids/DataGrid";
export { default as GridHeader } from "./components/grids/GridHeader";
export { default as EditableCell } from "./components/grids/EditableCell";
export * from "./components/grids/PresentationalTableChrome";
export { default as GridWrapper } from "./components/GridWrapper";
export * from "./components/SortableTableHead";
export * from "./components/EmptyTableRow";
export { default as ColumnToggle } from "./components/ColumnToggle";
export * from "./components/grids/cellRegistry";
export * from "./components/grids/rowAccentRegistry";
export * from "./components/GridStatus";

// ── Admin Grid Editor ────────────────────────────────────────────────────────
export { default as GridEditor } from "./components/admin/gridEditor/GridEditor";
export { default as GridPreview } from "./components/admin/gridEditor/GridPreview";
export { default as GridFocusMode } from "./components/admin/gridEditor/GridFocusMode";
export * from "./components/admin/gridEditor/apiPreviewRegistry";
export * from "./components/admin/gridEditor/datasetSchemas";
export * from "./components/admin/gridEditor/previewStaging";
export * from "./components/admin/gridEditor/useGridDraft";

// ── Shell ────────────────────────────────────────────────────────────────────
export { default as AppSidebar } from "./components/AppSidebar";
export { default as CommandPalette } from "./components/CommandPalette";
export { default as GlobalSearchBar } from "./components/GlobalSearchBar";
export { default as KeyboardShortcutsSheet } from "./components/KeyboardShortcutsSheet";
export { default as PageHeader } from "./components/PageHeader";
export { default as PageToolbar } from "./components/PageToolbar";
export { default as PageSkeleton } from "./components/PageSkeleton";
export { default as Breadcrumb } from "./components/Breadcrumb";
export { default as AppFooter } from "./components/AppFooter";
export * from "./components/EmptyState";
export * from "./components/navRegistry";
export * from "./components/searchSourceRegistry";
export * from "./lib/commandRoutes";

// ── Auth ─────────────────────────────────────────────────────────────────────
export { default as ProtectedRoute } from "./components/ProtectedRoute";
export { default as ModuleDisabled } from "./components/ModuleDisabled";
export * from "./context/AuthContext";
export * from "./hooks/useAuth";
export * from "./hooks/useModules";

// ── Hooks ────────────────────────────────────────────────────────────────────
export * from "./hooks/useGridConfig";
export * from "./hooks/useUserGridConfig";
export * from "./hooks/useAdminPlatform";
export * from "./hooks/useTableState";
export * from "./hooks/useDensity";
export * from "./hooks/useDraggableColumns";
export * from "./hooks/useRowClickHandler";
export * from "./hooks/useAppConfig";
export * from "./hooks/useAppSettings";
export * from "./hooks/useMediaQuery";
export * from "./hooks/usePersistedDisclosure";
export * from "./hooks/queryKeys";

// ── Context + stores ─────────────────────────────────────────────────────────
export * from "./context/ThemeContext";
export * from "./context/KeyboardShortcutsContext";
export * from "./store/commandPaletteStore";
export * from "./store/selectionStore";
export * from "./store/sidebarStore";
export * from "./store/flyoutStore";

// ── Lib ──────────────────────────────────────────────────────────────────────
export * from "./lib/utils";
export * from "./lib/fuzzyMatch";
export * from "./lib/shortcuts";
export * from "./utils/conditionalFormat";
export * from "./utils/rankStyle";
export * from "./utils/gridUtils";
export * from "./types/grid";
export * from "./api/client";
export * from "./api/routes";
