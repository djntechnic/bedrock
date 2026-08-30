const queryKeys = {
  // ── Admin ────────────────────────────────────────────────────────────────
  admin: {
    /** Root key — invalidates every admin query, including an app's own. */
    all: ["admin"],
    logs: (params) => ["admin", "logs", params],
    syncSchedule: () => ["admin", "sync_schedule"],
    syncStatus: () => ["admin", "sync_status"],
    usersSummary: () => ["admin", "users_summary"],
    users: () => ["admin", "users"],
    user: (userId) => ["admin", "user", userId],
    sessions: () => ["admin", "sessions"],
    securityEvents: (params) => ["admin", "security_events", params],
    dbSummary: () => ["admin", "db_summary"],
    config: (category) => category === void 0 ? ["admin", "config"] : ["admin", "config", category],
    /** Broad prefix used by invalidateQueries after a create/update/delete. */
    configAll: () => ["admin", "config"],
    grids: () => ["admin", "grids"],
    gridPages: () => ["admin", "grid_pages"],
    gridColumns: (gridId) => ["admin", "grid_columns", gridId],
    /** Broad prefix — invalidates every grid_columns cache. */
    gridColumnsAll: () => ["admin", "grid_columns"],
    exports: () => ["admin", "exports"],
    lookupUiQueryConfig: () => ["admin", "lookup", "ui_query_config"],
    /** Broad prefix — invalidates every lookup-table cache, an app's included. */
    lookupAll: () => ["admin", "lookup"],
    apiHealth: () => ["admin", "api_health"],
    health: () => ["health"],
    audit: () => ["admin", "audit"],
    auditHistory: (limit) => ["admin", "audit-history", limit],
    /** Broad prefix — invalidates every audit-history page regardless of limit. */
    auditHistoryAll: () => ["admin", "audit-history"],
    auditRun: (runId) => ["admin", "audit-run", runId]
  },
  // ── App-wide config ──────────────────────────────────────────────────────
  appConfig: {
    all: ["app_config"]
  },
  // ── Diagnostics ──────────────────────────────────────────────────────────
  diagnostics: {
    all: ["diagnostics"],
    runs: () => ["diagnostics", "runs"],
    run: (runId) => ["diagnostics", "run", runId],
    schedule: () => ["diagnostics", "schedule"]
  },
  // ── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    all: ["auth"],
    me: () => ["auth", "me"]
  },
  // ── User preferences ─────────────────────────────────────────────────────
  userPreferences: {
    /** Root key — invalidates every user-preferences query. */
    all: ["user_preferences"],
    grids: () => ["user_preferences", "grids"],
    grid: (gridId) => ["user_preferences", "grids", gridId]
  },
  // ── Modules ──────────────────────────────────────────────────────────────
  modules: {
    all: ["modules"],
    list: () => ["modules", "list"],
    /** Token-scoped cache so login/logout invalidates the anon set cleanly. */
    me: (token) => ["modules", "me", token ?? "anon"],
    registry: () => ["modules", "registry"],
    forUser: (userId) => ["modules", "user", userId]
  },
  // ── Navigation ────────────────────────────────────────────────────────────
  navigation: {
    all: ["navigation"],
    settings: () => ["navigation", "settings"]
  },
  // ── Security ─────────────────────────────────────────────────────────────
  security: {
    all: ["security"],
    matrix: () => ["security", "matrix"],
    roles: () => ["security", "roles"],
    role: (roleId) => ["security", "role", roleId],
    myPermissions: (token) => ["security", "myPermissions", token ?? "anon"],
    userOverrides: (userId) => ["security", "userOverrides", userId],
    userProfile: (userId) => ["security", "userProfile", userId]
  }
};
export {
  queryKeys
};
//# sourceMappingURL=queryKeys.js.map
