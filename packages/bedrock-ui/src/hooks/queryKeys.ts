/**
 * @file queryKeys.ts
 * @module @djntechnic/bedrock-ui/hooks
 * @description TanStack Query key factory for the platform's own caches.
 * Hooks derive `queryKey` from these builders instead of inlining string
 * arrays.
 *
 * Scoped the same way as `api/routes.ts`: a key here indexes data a
 * `bedrock-api` endpoint returns. An application's keys live in the
 * application, composed with these — otherwise every consumer inherits cache
 * keys for domains it does not have, and two apps' invalidations collide in a
 * shared prefix nobody owns.
 */

/** Query key builders grouped by platform concern. */
export const queryKeys = {
  // ── Admin ────────────────────────────────────────────────────────────────
  admin: {
    /** Root key — invalidates every admin query, including an app's own. */
    all: ["admin"] as const,
    logs: (params: unknown) => ["admin", "logs", params] as const,
    syncSchedule: () => ["admin", "sync_schedule"] as const,
    syncStatus: () => ["admin", "sync_status"] as const,
    usersSummary: () => ["admin", "users_summary"] as const,
    users: () => ["admin", "users"] as const,
    user: (userId: number | string) => ["admin", "user", userId] as const,
    sessions: () => ["admin", "sessions"] as const,
    securityEvents: (params: unknown) => ["admin", "security_events", params] as const,
    dbSummary: () => ["admin", "db_summary"] as const,
    config: (category?: string) =>
      category === undefined
        ? (["admin", "config"] as const)
        : (["admin", "config", category] as const),
    /** Broad prefix used by invalidateQueries after a create/update/delete. */
    configAll: () => ["admin", "config"] as const,
    grids: () => ["admin", "grids"] as const,
    gridPages: () => ["admin", "grid_pages"] as const,
    gridColumns: (gridId: string | null) =>
      ["admin", "grid_columns", gridId] as const,
    /** Broad prefix — invalidates every grid_columns cache. */
    gridColumnsAll: () => ["admin", "grid_columns"] as const,
    exports: () => ["admin", "exports"] as const,
    lookupUiQueryConfig: () => ["admin", "lookup", "ui_query_config"] as const,
    /** Broad prefix — invalidates every lookup-table cache, an app's included. */
    lookupAll: () => ["admin", "lookup"] as const,
    apiHealth: () => ["admin", "api_health"] as const,
    health: () => ["health"] as const,
    audit: () => ["admin", "audit"] as const,
    auditHistory: (limit: number) => ["admin", "audit-history", limit] as const,
    /** Broad prefix — invalidates every audit-history page regardless of limit. */
    auditHistoryAll: () => ["admin", "audit-history"] as const,
    auditRun: (runId: string | number) =>
      ["admin", "audit-run", runId] as const,
  },

  // ── App-wide config ──────────────────────────────────────────────────────
  appConfig: {
    all: ["app_config"] as const,
  },

  // ── Diagnostics ──────────────────────────────────────────────────────────
  diagnostics: {
    all: ["diagnostics"] as const,
    runs: () => ["diagnostics", "runs"] as const,
    run: (runId: string | number) => ["diagnostics", "run", runId] as const,
    schedule: () => ["diagnostics", "schedule"] as const,
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },

  // ── User preferences ─────────────────────────────────────────────────────
  userPreferences: {
    /** Root key — invalidates every user-preferences query. */
    all: ["user_preferences"] as const,
    grids: () => ["user_preferences", "grids"] as const,
    grid: (gridId: string) => ["user_preferences", "grids", gridId] as const,
  },

  // ── Modules ──────────────────────────────────────────────────────────────
  modules: {
    all: ["modules"] as const,
    /** Token-scoped cache so login/logout invalidates the anon set cleanly. */
    me: (token: string | null) => ["modules", "me", token ?? "anon"] as const,
    registry: () => ["modules", "registry"] as const,
    forUser: (userId: number | string) => ["modules", "user", userId] as const,
  },

  // ── Security ─────────────────────────────────────────────────────────────
  security: {
    all: ["security"] as const,
    myPermissions: (token: string | null) => ["security", "my-permissions", token ?? "anon"] as const,
    roles: () => ["security", "roles"] as const,
    matrix: () => ["security", "matrix"] as const,
    userProfile: (userId: number | string) => ["security", "user-profile", userId] as const,
  },

  // ── Navigation ───────────────────────────────────────────────────────────
  navigation: {
    all: ["navigation"] as const,
    settings: () => ["navigation", "settings"] as const,
  },
} as const;
