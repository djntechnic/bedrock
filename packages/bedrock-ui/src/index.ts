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
export type { CustomCellCtx, CustomHeaderCtx, DataGridProps } from "./components/grids/DataGrid";
export { default as GridHeader } from "./components/grids/GridHeader";
export { default as EditableCell } from "./components/grids/EditableCell";
export type { EditableCellProps } from "./components/grids/EditableCell";
export * from "./components/grids/PresentationalTableChrome";
export { default as GridFocusShell } from "./components/grids/GridFocusShell";
export type { GridFocusShellProps } from "./components/grids/GridFocusShell";
export { useCellSelection, parseTsv, toTsv } from "./components/grids/useCellSelection";
export type {
  CellRef,
  CellRange,
  CellRangeFill,
  CellRangePaste,
  CellSelection,
  UseCellSelectionOptions,
} from "./components/grids/useCellSelection";
export { default as GridWrapper } from "./components/GridWrapper";
export type { ManualPagination } from "./components/GridWrapper";
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
export type { BreadcrumbItem } from "./components/Breadcrumb";
export { default as AppFooter } from "./components/AppFooter";
export * from "./components/EmptyState";
// `ThemeProvider` mounts this already; exported for a host that opts out with
// `toaster={false}` and places its own, and re-exported `toast` so a consumer
// does not have to depend on `sonner` directly to raise one.
export { Toaster } from "./components/ui/sonner";
export type { PlatformToasterProps } from "./components/ui/sonner";
export { toast } from "sonner";
export * from "./components/navRegistry";
export * from "./components/searchSourceRegistry";
export * from "./lib/commandRoutes";

// ── Auth ─────────────────────────────────────────────────────────────────────
export { default as ProtectedRoute } from "./components/ProtectedRoute";
export { default as ModuleDisabled } from "./components/ModuleDisabled";
export * from "./context/AuthContext";
export * from "./hooks/useAuth";
export * from "./hooks/useModules";
// Mail-driven flows (F1). The paths these mount at are fixed by the platform —
// the backend builds the emailed links from the same constants — so an app
// wires them to `AUTH_FLOW_PATHS` rather than choosing its own.
export { default as SetPasswordPage } from "./components/auth/SetPasswordPage";
export type { SetPasswordPageProps } from "./components/auth/SetPasswordPage";
export { default as ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
export type { ForgotPasswordPageProps } from "./components/auth/ForgotPasswordPage";
export { default as VerifyEmailPage } from "./components/auth/VerifyEmailPage";
export type { VerifyEmailPageProps } from "./components/auth/VerifyEmailPage";
export { default as AuthFlowCard } from "./components/auth/AuthFlowCard";
export type { AuthFlowCardProps } from "./components/auth/AuthFlowCard";
export * from "./components/auth/authFlowApi";

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
// Per-route document head (F5). The sitemap half is server-side.
export * from "./hooks/useDocumentHead";

// ── Context + stores ─────────────────────────────────────────────────────────
export * from "./context/AppConfigContext";
export * from "./context/ThemeContext";
export * from "./context/KeyboardShortcutsContext";
export * from "./store/commandPaletteStore";
export * from "./store/selectionStore";
export * from "./store/sidebarStore";
export * from "./store/flyoutStore";

// ── UI primitives ────────────────────────────────────────────────────────────
// shadcn components are normally copy-in-and-edit. They ship here instead
// because §S9 already routes every color through a CSS token, so an app
// restyles them by overriding token values rather than by forking the
// component. Apps stay free to `shadcn add` primitives of their own.
export * from "./components/ui/alert-dialog";
export * from "./components/ui/badge";
export * from "./components/ui/button";
export * from "./components/ui/card";
export * from "./components/ui/collapsible";
export * from "./components/ui/command";
export * from "./components/ui/dialog";
export * from "./components/ui/input";
export * from "./components/ui/label";
export * from "./components/ui/popover";
export * from "./components/ui/segmented-control";
export * from "./components/ui/select";
export * from "./components/ui/sheet";
export * from "./components/ui/skeleton";
export * from "./components/ui/stat-badge";
export * from "./components/ui/switch";
export * from "./components/ui/table";
export * from "./components/ui/tabs";
export * from "./components/ui/tooltip";

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
export * from "./lib/logger";
export * from "./utils/logger";
