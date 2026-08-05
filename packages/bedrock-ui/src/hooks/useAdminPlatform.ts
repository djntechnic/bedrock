/**
 * @file useAdminPlatform.ts
 * @module frontend/src/hooks
 * @description Admin console hooks for the reusable application platform:
 * KPI + database summary, app-config CRUD, grid settings/column CRUD, users,
 * sessions, security events, export history, system logs, api-health,
 * diagnostics, and the project audit surface.
 *
 * Everything here is app-agnostic — it depends only on tables the platform
 * owns (app_config_settings, app_grid_*, auth_*, log_*, import_*, diag_*).
 * MLBTracker's baseball-specific admin hooks live in ./useAdminDomain.
 *
 * Consumers should keep importing from ./useAdmin, which re-exports both
 * halves; this file is the framework-boundary side of that split.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiResponse } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { useAppConfigContext, getHookConfig } from "./useAppConfig";
import { queryKeys } from "./queryKeys";

/** High-level system performance and status metrics. */
export interface AdminKpi {
// ...
  /** Total number of registered users. */
  users: number;
  /** Total number of players in the master database. */
  players: number;
  /** Number of unique seasons with statistical data. */
  stat_seasons: number;
  /** Timestamp of the most recent successful sync run. */
  last_sync: string | null;
}

/** User account metadata for the admin console (Phase 5.8). */
export interface UserRecord {
  user_id: number;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  roles: string[];
  created_at: string;
  last_login_at: string | null;
}

/** Summary counts for the admin dashboard KPI tile (Phase 5.8). */
export interface UserSummary {
  total: number;
  active: number;
  inactive: number;
}

/** Payload for PATCH /admin/users/{id} (Phase 5.8). */
export interface UserUpdatePayload {
  is_active?: boolean;
  roles?: string[];
}

/** Payload for POST /admin/users/invite (Phase 5.8). */
export interface UserInvitePayload {
  email: string;
  display_name?: string | null;
  role: string;
  password?: string | null;
}

/** Database table storage metrics. */
export interface DbTableSummary {
  /** Physical name of the table in the database. */
  table_name: string;
  /** Approximate or exact row count. */
  row_count: number;
  /** Storage size in bytes. */
  table_size?: number;
}

export interface DbSummaryResponse {
  overall_size: number;
  tables: DbTableSummary[];
}

export interface ApiHealthEntry {
  method: string;
  path: string;
  name: string;
  hits: number;
  hits_24h: number;
  errors: number;
  last_accessed: string | null;
  status: "Healthy" | "Error";
  // documentation
  summary: string;
  description: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    description: string;
    default: unknown;
  }>;
  body_fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default: unknown;
  }>;
  response_schema: string | null;
  tags: string[];
  documented: boolean;
}

/** Application-wide configuration setting. */
export interface ConfigSetting {
  /** Optional primary key. */
  config_id?: number;
  /** Unique key for the setting. */
  key: string;
  /** String representation of the value. */
  value: string | null;
  /** Data type for validation (e.g., 'int', 'bool'). */
  value_type: string;
  /** Descriptive text explaining the setting's purpose. */
  description: string | null;
  /** Organizational category for the admin UI. */
  category: string;
  /** ISO timestamp of the last modification. */
  modified_at?: string;
  /** Username of the last person to edit the setting. */
  modified_by?: string;
}

/** High-level grid behavior and visual style configuration. */
export interface GridSetting {
  grid_setting_id?: number;
  /** Stable identifier for the grid (e.g., 'leaderboard_batting'). */
  grid_id: string;
  /** Human-readable label for the grid. */
  grid_label: string;
  /** Screen/page this grid renders on. Drives the admin Grid Editor's Screen dropdown. */
  page?: string | null;
  /** Optional title to display above the grid. */
  title?: string | null;
  /** Optional sub-header text. */
  sub_header?: string | null;
  /** Optional footer text. */
  footer?: string | null;
  /** Whether the column toggle popover is enabled. Phase 2.c: bool at the wire boundary. */
  allow_column_toggle: boolean;
  /** Whether CSV export is permitted. */
  allow_export: boolean;
  /** Whether the grid data is read-only. */
  read_only: boolean;
  /** Default rows to display per page. */
  default_page_size: number;
  /** Comma-separated list of page size choices. */
  page_size_options: string;
  /** Whether pagination controls are visible. */
  pagination_enabled: boolean;
  /** Whether the header sticks to the top during scroll. */
  sticky_header: boolean;
  /** STUB: Future support for horizontal sticky columns. */
  sticky_first_column: boolean;
  /** Whether alternating rows have background tinting. */
  row_striping: boolean;
  /** Whether to use reduced cell padding. */
  dense_mode: boolean;
  /** ID of the column to sort by default. */
  default_sort_column?: string | null;
  /** Default sort direction ('asc' or 'desc'). */
  default_sort_direction?: string | null;
  /** Whether to show 'Total Rows' in the footer. */
  show_row_count: boolean;
  /** Whether to show a 'Ranking' column based on row number. */
  show_ranking: boolean;
  /** Whether cell content should wrap or truncate. */
  wrap_text: boolean;
  /** Minimum width in pixels for all columns. */
  min_column_width: number;
  /** Optional CSS color for the sorted-ascending column header/cells (e.g. '#e0f2fe'). */
  sort_asc_color?: string | null;
  /** Optional CSS color for the sorted-descending column header/cells (e.g. '#fce7f3'). */
  sort_desc_color?: string | null;
  /** Optional CSS background color for row hover (e.g. 'rgba(59,130,246,0.08)'). */
  hover_color?: string | null;
  /** Whether a compare-selection checkbox column is prepended. Replaces the prop-driven onSelectionChange pattern. */
  allow_selection?: boolean;
  /** Whether the unified GridHeader exposes a clean print / PDF layout trigger for this grid. */
  allow_print?: boolean;
  /** Tooltip open latency (ms) for this grid's TooltipProviders. Null = use appSettings default. */
  tooltip_delay_duration?: number | null;
  /** Whether the unified GridHeader exposes an inline search input. */
  show_search?: boolean;
  /** Whether the unified GridHeader exposes the density toggle. */
  show_density_toggle?: boolean;
  /** Whether the unified GridHeader exposes medal / podium ranking toggles. */
  show_medal_toggles?: boolean;
  /**
   * Row-object field carrying the row's stable ID (drives the config-driven
   * selection column and TanStack row keying). Typically `"player_id"`,
   * `"mlb_id"`, or `"card_id"`. Required as of Phase 7 D1 — `<DataGrid>`
   * throws at render time if this is null.
   */
  row_key_column?: string | null;
  /** Semantic `<caption>` element text rendered inside the `<Table>` (a11y surface). */
  caption?: string | null;
  /** Phase 5: drag-and-drop column reordering (session-local for end users, persisted in admin editor). */
  allow_column_reorder?: boolean;
  /**
   * Phase 10 B2: expander column + `renderSubRow` slot on `<DataGrid>`.
   * When true and the consumer supplies `renderSubRow`, the engine
   * prepends a chevron cell that toggles a caller-owned detail row.
   */
  allow_expansion?: boolean;
  /** Phase 3 §S9: condensed tabular-numeral style for `cell_type: "number"` cells. */
  numeral_style?: "default" | "tabular" | string;
  /** Phase 3 §S9: flash changed cells with the `--live-pulse` token cue. */
  live_update_highlight?: boolean;
  /** Phase 3 §S9: tint each row with its player's `--team-accent` color. */
  team_accent_reactive?: boolean;
}

/** Metadata for a specific column within a grid. */
export interface GridColumnSetting {
  column_setting_id?: number;
  /** FK to the parent grid setting. */
  grid_setting_id: number;
  /** Stable ID for the column (must match data key). */
  column_id: string;
  /** Custom label to display in the header. */
  label_override?: string | null;
  /** Custom tooltip text for the header. */
  tooltip_override?: string | null;
  /** Whether the column is visible by default. Phase 2.c: bool at the wire boundary. */
  default_visible: boolean;
  /** Default sort direction if this is the sort column. */
  default_sort?: string | null;
  /** STUB: Future support for default filter values. */
  default_filter?: string | null;
  /** Numeric order for horizontal placement (0-based). */
  column_order: number;
  /** Python-style format string (e.g., '.3f'). */
  format_string?: string | null;
  /** Text to show for null/undefined values. */
  null_display: string;
  /** Whether the user can sort by this column. */
  allow_sort: boolean;
  /**
   * Phase 2: 4-state sort mode enum (`"none" | "asc" | "desc" | "both"`).
   * Supersedes the boolean `allow_sort`. `"none"` disables sorting, `"both"`
   * is the standard toggle, `"asc"`/`"desc"` lock the direction (header
   * click clamps to the locked direction or clears sort).
   */
  allow_sort_mode?: "none" | "asc" | "desc" | "both";
  /** Whether the user can filter by this column. */
  allow_filter: boolean;
  /** Whether the column is hidden from the toggle list. */
  read_only: boolean;
  /** Fixed width in pixels. */
  width?: number | null;
  /** Minimum width to prevent layout collapse. */
  min_width: number;
  /** Maximum width to prevent excessive expansion. */
  max_width?: number | null;
  /** STUB: Future support for pinned columns. */
  pinned?: string | null;
  /** Horizontal alignment ('left', 'center', 'right'). */
  text_align: string;
  /** Whether cell content in this column should wrap. */
  wrap_text: boolean;
  /** Whether the user can manually resize the column. */
  resizable: boolean;
  /** Specialized renderer type (e.g., 'badge', 'currency'). */
  cell_type: string;
  /** Optional summary function (e.g., 'sum', 'avg') for the footer. */
  aggregate_function?: string | null;
  /** JSON-stringified conditional formatting rules. */
  conditional_format?: string | null;
  /** STUB: Future support for clickable links. */
  link_target?: string | null;
  /** STUB: Future support for row grouping. */
  group_by: boolean;
  /** CSS color for this column's header/cells when sorted ascending. Overrides GridSetting.sort_asc_color. */
  sort_asc_color?: string | null;
  /** CSS color for this column's header/cells when sorted descending. Overrides GridSetting.sort_desc_color. */
  sort_desc_color?: string | null;
  /** Start CSS color for value-gradient coloring (e.g., '#22c55e' green = best). Null = no gradient. */
  gradient_from_color?: string | null;
  /** End CSS color for value-gradient coloring (e.g., '#ef4444' red = worst). Null = no gradient. */
  gradient_to_color?: string | null;
  /**
   * Phase 8 H3: opt-in inline editing. `true` promotes the cell to the
   * `<EditableCell>` primitive at render time. Disabled at runtime when
   * the host grid does not supply `onCellCommit` or when
   * `config.readOnly === 1`.
   */
  editable?: boolean;
}

/** Audit log entry for a CSV or PDF export event. */
export interface ExportRun {
  export_id: number;
  /** Type of file exported ('csv' or 'pdf'). */
  export_type: string;
  /** Page ID where the export was triggered. */
  page: string;
  /** Number of rows included in the export. */
  row_count: number | null;
  /** User-provided note about the export. */
  user_note: string | null;
  /** ISO timestamp of the export. */
  exported_at: string;
  /** Username of the exporter. */
  exported_by: string;
}

/** System audit log entry. */
export interface LogEntry {
  /** Category of event ('activity', 'import', 'export'). */
  source: string;
  /** Specific event code (e.g., 'SYNC_START', 'USER_LOGIN'). */
  event_type: string;
  /** Human-readable description of the event. */
  message: string;
  /** ISO timestamp of the event. */
  timestamp: string;
  /** Optional JSON or text block with extra context. */
  detail?: string | null;
}

/** Fetches high-level administrative KPIs. */
export function useAdminKpi() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useAdminKpi", appConfig);

  return useQuery<ApiResponse<AdminKpi>>({
    queryKey: queryKeys.admin.kpi(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.kpi());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches system logs with optional filtering and pagination. */
export function useLogs(params?: {
  source?: string;
  event_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useLogs", appConfig);

  return useQuery<ApiResponse<LogEntry[]>>({
    queryKey: queryKeys.admin.logs(params),
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params?.source && params.source !== "all")
        p.set("source", params.source);
      if (params?.event_type) p.set("event_type", params.event_type);
      if (params?.date_from) p.set("date_from", params.date_from);
      if (params?.date_to) p.set("date_to", params.date_to);
      if (params?.limit) p.set("limit", String(params.limit));
      const { data } = await apiClient.get(API_ROUTES.admin.logs(p.toString()));
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches a summary of system users and their roles. */
export function useUserSummary() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useUserSummary", appConfig);

  return useQuery<ApiResponse<UserSummary>>({
    queryKey: queryKeys.admin.usersSummary(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.usersSummary());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches row counts for all application database tables. */
export function useDbSummary() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useDbSummary", appConfig);

  return useQuery<ApiResponse<DbSummaryResponse>>({
    queryKey: queryKeys.admin.dbSummary(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.databaseSummary());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Creates a new app configuration setting. */
export function useCreateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { key: string; value: string; value_type: string; description?: string; category: string }) => {
      const { data } = await apiClient.post(API_ROUTES.admin.config(), body);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() }); },
  });
}

/** Deletes an app configuration setting by key. */
export function useDeleteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await apiClient.delete(API_ROUTES.admin.configItem(key));
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() }); },
  });
}

/** Fetches global app configuration settings. */
export function useConfigSettings(category?: string) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useConfigSettings", appConfig);

  return useQuery<ApiResponse<ConfigSetting[]>>({
    queryKey: queryKeys.admin.config(category),
    queryFn: async () => {
      const p = category ? `?category=${category}` : "";
      const { data } = await apiClient.get(`${API_ROUTES.admin.config()}${p}`);
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches the master list of grid behavior settings. */
export function useGridSettings() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridSettings", appConfig);

  return useQuery<ApiResponse<GridSetting[]>>({
    queryKey: queryKeys.admin.grids(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.grids());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/**
 * Fetches the distinct set of screens/pages that have at least one grid
 * registered. Data-driven source for the admin Grid Editor's Screen dropdown.
 */
export function useGridPages() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridSettings", appConfig);

  return useQuery<ApiResponse<string[]>>({
    queryKey: queryKeys.admin.gridPages(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.gridPages());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches column-level metadata for a specific grid. */
export function useGridColumns(gridId: string | null) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridColumns", appConfig);

  return useQuery<ApiResponse<GridColumnSetting[]>>({
    queryKey: queryKeys.admin.gridColumns(gridId),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.gridColumns(gridId as string));
      return data;
    },
    enabled: gridId !== null,
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Fetches the audit log for data exports. */
export function useExportHistory() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useExportHistory", appConfig);

  return useQuery<ApiResponse<ExportRun[]>>({
    queryKey: queryKeys.admin.exports(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.exports());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

/** Updates a single configuration key and invalidates relevant caches. */
export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...updates }: { key: string; value?: string; value_type?: string; description?: string; category?: string; newKey?: string }) => {
      const body: Record<string, string> = {};
      if (updates.value !== undefined) body.value = updates.value;
      if (updates.value_type !== undefined) body.value_type = updates.value_type;
      if (updates.description !== undefined) body.description = updates.description;
      if (updates.category !== undefined) body.category = updates.category;
      if (updates.newKey !== undefined) body.key = updates.newKey;
      const { data } = await apiClient.patch(API_ROUTES.admin.configItem(key), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() });
    },
  });
}

/** Updates column metadata for a grid and invalidates grid settings. */
export function useUpdateGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      columnId,
      updates,
    }: {
      gridId: string;
      columnId: string;
      updates: Partial<GridColumnSetting>;
    }) => {
      const { data } = await apiClient.patch(API_ROUTES.admin.gridColumn(gridId, columnId), updates);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    },
  });
}

/** Inserts a new column row on a grid; invalidates the grid's column list. */
export function useCreateGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      seed,
    }: {
      gridId: string;
      seed: Partial<GridColumnSetting> & { column_id: string };
    }) => {
      const { data } = await apiClient.post(
        API_ROUTES.admin.gridColumns(gridId),
        seed,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    },
  });
}

/** Deletes a column row from a grid; invalidates the grid's column list. */
export function useDeleteGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      columnId,
    }: {
      gridId: string;
      columnId: string;
    }) => {
      const { data } = await apiClient.delete(
        API_ROUTES.admin.gridColumn(gridId, columnId),
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    },
  });
}

/** Updates grid-level behavior settings and invalidates grid settings. */
export function useUpdateGridSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      updates,
    }: {
      gridId: string;
      updates: Partial<GridSetting>;
    }) => {
      const { data } = await apiClient.patch(API_ROUTES.admin.grid(gridId), updates);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
    },
  });
}

/** Logs a data export event for audit purposes. */
export function useLogExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      export_type: "csv" | "pdf";
      page: string;
      row_count?: number;
      user_note?: string;
    }) => {
      const { data } = await apiClient.post(API_ROUTES.admin.exportsLog(), payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.exports() });
    },
  });
}

/** Unified admin access hook. */
export function useAdmin() {
  const { mutate: logExport } = useLogExport();
  return { logExport };
}

/**
 * Phase 4c-3 extraction: HealthCheckPage's system-health query, hoisted out
 * of the page component to satisfy the audit's no-direct-@tanstack/react-query
 * rule for files under `pages/`. Behaviour is unchanged — same query key,
 * same endpoint, same appConfig-driven refetch interval.
 */
export function useHealthCheck<T = unknown>() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useHealthCheck", appConfig);
  return useQuery<ApiResponse<T>>({
    queryKey: queryKeys.admin.health(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<T>>("/api/v1/health");
      return data;
    },
    refetchInterval: cfg.refetchInterval ?? 30_000,
  });
}

/**
 * Phase 4c-3 extraction: returns a stable callback that invalidates the
 * diagnostic-runs cache. Lets HealthCheckPage's diagnostics-polling
 * useEffect stay out of the direct-@tanstack/react-query import surface.
 */
export function useInvalidateDiagnosticRuns() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.diagnostics.runs() });
  };
}

/** Fetches versioned API health statistics. */
export function useApiHealth() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useApiHealth", appConfig);

  return useQuery<ApiResponse<ApiHealthEntry[]>>({
    queryKey: queryKeys.admin.apiHealth(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.apiHealth());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? undefined,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus,
  });
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  result_id: number;
  run_id: number;
  test_name: string;
  test_group: string;
  status: "pass" | "fail" | "skip" | "error";
  message: string | null;
  duration_ms: number | null;
  retries: number;
  error_detail: string | null;
  /** Optional structured error summary surfaced alongside error_detail. */
  error_message?: string | null;
}

export interface DiagnosticRun {
  run_id: number;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "complete" | "error";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results?: DiagnosticResult[];
}

export interface DiagnosticSchedule {
  enabled: boolean;
  schedule_time: string;
  retention_days: number;
}

export function useDiagnosticRuns() {
  return useQuery<ApiResponse<DiagnosticRun[]>>({
    queryKey: queryKeys.diagnostics.runs(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.runs());
      return data;
    },
    staleTime: 1000 * 30,
  });
}

export function useDiagnosticRun(runId: number | null) {
  return useQuery<ApiResponse<DiagnosticRun>>({
    queryKey: queryKeys.diagnostics.run(runId as string | number),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.run(runId as number));
      return data;
    },
    enabled: runId != null,
    staleTime: 1000 * 30,
  });
}

export function useTriggerDiagnosticRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(API_ROUTES.diagnostics.triggerRun());
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.diagnostics.all });
    },
  });
}

export function useDiagnosticSchedule() {
  return useQuery<ApiResponse<DiagnosticSchedule>>({
    queryKey: queryKeys.diagnostics.schedule(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.schedule());
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateDiagnosticSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<DiagnosticSchedule>) => {
      const { data } = await apiClient.patch(API_ROUTES.diagnostics.schedule(), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.diagnostics.schedule() });
    },
  });
}

export interface AuditFinding {
  check: string;
  file: string;
  line: number;
  detail: string;
  severity: "P1" | "P2" | "P3";
}

export interface AuditResult {
  run_at: string;
  findings: AuditFinding[];
  summary: { P1: number; P2: number; P3: number; total: number };
  checks_run: string[];
}

export function useAuditResults(enabled: boolean) {
  return useQuery<ApiResponse<AuditResult>>({
    queryKey: queryKeys.admin.audit(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AuditResult>>(API_ROUTES.admin.audit());
      return data;
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export interface AuditRunSummary {
  id: number;
  run_at: string | null;
  triggered_by: string;
  checks_run: string[];
  summary_p1: number;
  summary_p2: number;
  summary_p3: number;
  total: number;
  duration_ms: number | null;
}

export interface AuditRunDetail extends AuditRunSummary {
  findings: AuditFinding[];
  summary: { P1: number; P2: number; P3: number; total: number };
}

export function useAuditHistory(limit = 20) {
  return useQuery<ApiResponse<AuditRunSummary[]>>({
    queryKey: queryKeys.admin.auditHistory(limit),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AuditRunSummary[]>>(API_ROUTES.admin.auditHistory(limit));
      return data;
    },
    staleTime: 30_000,
  });
}

export function useAuditRunDetail(runId: number | null) {
  return useQuery<ApiResponse<AuditRunDetail>>({
    queryKey: queryKeys.admin.auditRun(runId ?? -1),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AuditRunDetail>>(API_ROUTES.admin.auditRun(runId as number));
      return data;
    },
    enabled: runId != null,
    staleTime: 0,
  });
}

// ── Phase 5.8 Admin Users management ────────────────────────────────────────

export function useAdminUsers() {
  return useQuery<ApiResponse<UserRecord[]>>({
    queryKey: queryKeys.admin.users(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UserRecord[]>>(
        API_ROUTES.admin.users(),
      );
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: UserUpdatePayload;
    }) => {
      const { data } = await apiClient.patch<ApiResponse<UserRecord>>(
        API_ROUTES.admin.user(userId),
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.usersSummary() });
    },
  });
}

export function useInviteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UserInvitePayload) => {
      const { data } = await apiClient.post<ApiResponse<UserRecord>>(
        API_ROUTES.admin.userInvite(),
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.usersSummary() });
    },
  });
}

// ── Phase 5.11 Admin Sessions ───────────────────────────────────────────────

export interface AdminSession {
  session_id: string;
  user_id: number;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export function useAdminSessions() {
  return useQuery<ApiResponse<AdminSession[]>>({
    queryKey: queryKeys.admin.sessions(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminSession[]>>(
        API_ROUTES.admin.sessions(),
      );
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useRevokeAdminSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(API_ROUTES.admin.session(sessionId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.sessions() });
    },
  });
}

// ── Phase 5.12 Security Log ─────────────────────────────────────────────────

export interface SecurityEvent {
  event_id: number;
  event_ts: string;
  event_type: string;
  user_id: number | null;
  user_email: string | null;
  target_user_id: number | null;
  target_user_email: string | null;
  actor_ip: string | null;
  user_agent: string | null;
  detail: Record<string, unknown> | null;
}

export interface SecurityEventsResponse {
  events: SecurityEvent[];
  limit: number;
  offset: number;
}

export interface SecurityEventsQuery {
  event_type?: string;
  user_id?: number;
  limit?: number;
  offset?: number;
}

export function useSecurityEvents(params: SecurityEventsQuery) {
  return useQuery<ApiResponse<SecurityEventsResponse>>({
    queryKey: queryKeys.admin.securityEvents(params),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.event_type) qs.set("event_type", params.event_type);
      if (params.user_id != null) qs.set("user_id", String(params.user_id));
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.offset != null) qs.set("offset", String(params.offset));
      const { data } = await apiClient.get<ApiResponse<SecurityEventsResponse>>(
        API_ROUTES.admin.securityEvents(qs.toString() || undefined),
      );
      return data;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
