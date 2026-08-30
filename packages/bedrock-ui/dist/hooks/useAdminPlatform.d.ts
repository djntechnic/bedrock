/**
 * @file useAdminPlatform.ts
 * @module frontend/src/hooks
 * @description Admin console hooks for the reusable application platform:
 * database summary, app-config CRUD, grid settings/column CRUD, users,
 * sessions, security events, export history, system logs, api-health,
 * diagnostics, and the project audit surface.
 *
 * `useAdminKpi` used to live here and does not any more: `/admin/kpi` is
 * served by the application, and its payload counted players and stat seasons.
 * A platform hook calling an app endpoint compiles fine and 404s in the next
 * app.
 *
 * Everything here is app-agnostic — it depends only on tables the platform
 * owns (app_config_settings, app_grid_*, auth_*, log_*, import_*, diag_*).
 * MLBTracker's baseball-specific admin hooks live in ./useAdminDomain.
 *
 * Consumers should keep importing from ./useAdmin, which re-exports both
 * halves; this file is the framework-boundary side of that split.
 */
import { type ApiResponse } from "../api/client";
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
    /** Which side the selection checkbox column sits on: 'start' | 'end' (default 'end'). */
    selection_position?: string | null;
    /** Whether the unified GridHeader exposes a clean print / PDF layout trigger for this grid. */
    allow_print?: boolean;
    /** Tooltip open latency (ms) for this grid's TooltipProviders. Null = use appSettings default. */
    tooltip_delay_duration?: number | null;
    /** Whether the unified GridHeader exposes an inline search input. */
    show_search?: boolean;
    /** Whether the unified GridHeader exposes the density toggle. */
    show_density_toggle?: boolean;
    /** Whether the unified GridHeader exposes the rank-highlight toggle. */
    show_rank_highlight?: boolean;
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
    /** Phase 3 §S9: tint each row with an accent color the row supplies. */
    row_accent_reactive?: boolean;
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
/** Fetches system logs with optional filtering and pagination. */
export declare function useLogs(params?: {
    source?: string;
    event_type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
}): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<LogEntry[]>>, Error>;
/** Fetches a summary of system users and their roles. */
export declare function useUserSummary(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<UserSummary>>, Error>;
/** Fetches row counts for all application database tables. */
export declare function useDbSummary(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<DbSummaryResponse>>, Error>;
/** Creates a new app configuration setting. */
export declare function useCreateConfig(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    key: string;
    value: string;
    value_type: string;
    description?: string;
    category: string;
}, unknown>;
/** Deletes an app configuration setting by key. */
export declare function useDeleteConfig(): import("@tanstack/react-query").UseMutationResult<any, Error, string, unknown>;
/** Fetches global app configuration settings. */
export declare function useConfigSettings(category?: string): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<ConfigSetting[]>>, Error>;
/** Fetches the master list of grid behavior settings. */
export declare function useGridSettings(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<GridSetting[]>>, Error>;
/**
 * Fetches the distinct set of screens/pages that have at least one grid
 * registered. Data-driven source for the admin Grid Editor's Screen dropdown.
 */
export declare function useGridPages(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<string[]>>, Error>;
/** Fetches column-level metadata for a specific grid. */
export declare function useGridColumns(gridId: string | null): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<GridColumnSetting[]>>, Error>;
/** Fetches the audit log for data exports. */
export declare function useExportHistory(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<ExportRun[]>>, Error>;
/** Updates a single configuration key and invalidates relevant caches. */
export declare function useUpdateConfig(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    key: string;
    value?: string;
    value_type?: string;
    description?: string;
    category?: string;
    newKey?: string;
}, unknown>;
/** Updates column metadata for a grid and invalidates grid settings. */
export declare function useUpdateGridColumn(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    columnId: string;
    updates: Partial<GridColumnSetting>;
}, unknown>;
/** Inserts a new column row on a grid; invalidates the grid's column list. */
export declare function useCreateGridColumn(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    seed: Partial<GridColumnSetting> & {
        column_id: string;
    };
}, unknown>;
/** Deletes a column row from a grid; invalidates the grid's column list. */
export declare function useDeleteGridColumn(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    columnId: string;
}, unknown>;
/** Updates grid-level behavior settings and invalidates grid settings. */
export declare function useUpdateGridSetting(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    updates: Partial<GridSetting>;
}, unknown>;
/** Logs a data export event for audit purposes. */
export declare function useLogExport(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    export_type: "csv" | "pdf";
    page: string;
    row_count?: number;
    user_note?: string;
}, unknown>;
/** Unified admin access hook. */
export declare function useAdmin(): {
    logExport: import("@tanstack/react-query").UseMutateFunction<any, Error, {
        export_type: "csv" | "pdf";
        page: string;
        row_count?: number;
        user_note?: string;
    }, unknown>;
};
/**
 * Phase 4c-3 extraction: HealthCheckPage's system-health query, hoisted out
 * of the page component to satisfy the audit's no-direct-@tanstack/react-query
 * rule for files under `pages/`. Behaviour is unchanged — same query key,
 * same endpoint, same appConfig-driven refetch interval.
 */
export declare function useHealthCheck<T = unknown>(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<T>>, Error>;
/**
 * Phase 4c-3 extraction: returns a stable callback that invalidates the
 * diagnostic-runs cache. Lets HealthCheckPage's diagnostics-polling
 * useEffect stay out of the direct-@tanstack/react-query import surface.
 */
export declare function useInvalidateDiagnosticRuns(): () => void;
/** Fetches versioned API health statistics. */
export declare function useApiHealth(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<ApiHealthEntry[]>>, Error>;
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
export declare function useDiagnosticRuns(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<DiagnosticRun[]>>, Error>;
export declare function useDiagnosticRun(runId: number | null): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<DiagnosticRun>>, Error>;
export declare function useTriggerDiagnosticRun(): import("@tanstack/react-query").UseMutationResult<any, Error, void, unknown>;
export declare function useDiagnosticSchedule(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<DiagnosticSchedule>>, Error>;
export declare function useUpdateDiagnosticSchedule(): import("@tanstack/react-query").UseMutationResult<any, Error, Partial<DiagnosticSchedule>, unknown>;
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
    summary: {
        P1: number;
        P2: number;
        P3: number;
        total: number;
    };
    checks_run: string[];
}
export declare function useAuditResults(enabled: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<AuditResult>>, Error>;
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
    summary: {
        P1: number;
        P2: number;
        P3: number;
        total: number;
    };
}
export declare function useAuditHistory(limit?: number): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<AuditRunSummary[]>>, Error>;
export declare function useAuditRunDetail(runId: number | null): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<AuditRunDetail>>, Error>;
export declare function useAdminUsers(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<UserRecord[]>>, Error>;
export declare function useUpdateAdminUser(): import("@tanstack/react-query").UseMutationResult<ApiResponse<UserRecord>, Error, {
    userId: number;
    payload: UserUpdatePayload;
}, unknown>;
export declare function useInviteAdminUser(): import("@tanstack/react-query").UseMutationResult<ApiResponse<UserRecord>, Error, UserInvitePayload, unknown>;
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
export declare function useAdminSessions(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<AdminSession[]>>, Error>;
export declare function useRevokeAdminSession(): import("@tanstack/react-query").UseMutationResult<void, Error, string, unknown>;
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
export declare function useSecurityEvents(params: SecurityEventsQuery): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<SecurityEventsResponse>>, Error>;
