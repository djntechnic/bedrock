/**
 * @file routes.ts
 * @module @djntechnic/bedrock-ui/api
 * @description Route builders for the endpoints **bedrock-api serves**. Hooks
 * reference these instead of inlining `/api/v1/...` literals.
 *
 * The test beside this file asserts every path here resolves to a route the
 * platform actually mounts. That is the boundary: a builder for an endpoint
 * this package does not serve belongs to the application that does, because
 * every consumer would otherwise inherit a map of another app's API — which is
 * what this file was until now. MLBTracker's half moved to its own
 * `frontend/src/api/routes.ts`, which composes the two.
 */

/**
 * Route builders grouped by platform concern. Add an endpoint here only when
 * `bedrock-api` mounts it.
 */
export const API_ROUTES = {
  // ── Admin ────────────────────────────────────────────────────────────────
  // The platform half of `/admin` — users, sessions, config, grids, exports,
  // logs and the audit runner. An application's own admin endpoints mount
  // under the same prefix and belong in the application's route map.
  admin: {
    logs: (queryString: string) => `/api/v1/admin/logs?${queryString}`,
    syncSchedule: () => "/api/v1/admin/sync/schedule",
    syncStatus: () => "/api/v1/admin/sync/status",
    usersSummary: () => "/api/v1/admin/users/summary",
    users: () => "/api/v1/admin/users",
    user: (userId: number | string) => `/api/v1/admin/users/${userId}`,
    userInvite: () => "/api/v1/admin/users/invite",
    sessions: () => "/api/v1/admin/sessions",
    session: (sessionId: string) => `/api/v1/admin/sessions/${sessionId}`,
    securityEvents: (qs?: string) =>
      qs ? `/api/v1/admin/security/events?${qs}` : "/api/v1/admin/security/events",
    databaseSummary: () => "/api/v1/admin/database/summary",
    config: (category?: string) =>
      category ? `/api/v1/admin/config?category=${category}` : "/api/v1/admin/config",
    configItem: (key: string) => `/api/v1/admin/config/${encodeURIComponent(key)}`,
    grids: () => "/api/v1/admin/grids",
    gridPages: () => "/api/v1/admin/grids/pages",
    gridColumns: (gridId: string) => `/api/v1/admin/grids/${gridId}/columns`,
    gridColumn: (gridId: string, columnId: string) =>
      `/api/v1/admin/grids/${gridId}/columns/${columnId}`,
    grid: (gridId: string) => `/api/v1/admin/grids/${gridId}`,
    exports: () => "/api/v1/admin/exports",
    exportsLog: () => "/api/v1/admin/exports/log",
    lookupUiQueryConfig: () => "/api/v1/admin/lookup/ui-query-config",
    apiHealth: () => "/api/v1/admin/api-health",
    audit: () => "/api/v1/admin/audit",
    auditHistory: (limit: number) => `/api/v1/admin/audit/history?limit=${limit}`,
    auditRun: (runId: string | number) => `/api/v1/admin/audit/history/${runId}`,
  },

  // ── User preferences (per-user grid customization) ───────────────────────
  userPreferences: {
    grids: () => "/api/v1/user-preferences/grids",
    grid: (gridId: string) => `/api/v1/user-preferences/grids/${gridId}`,
    gridColumn: (gridId: string, columnId: string) =>
      `/api/v1/user-preferences/grids/${gridId}/columns/${columnId}`,
  },

  // ── App-wide config ──────────────────────────────────────────────────────
  appConfig: {
    root: () => "/api/v1/config/app",
  },

  // ── Diagnostics ──────────────────────────────────────────────────────────
  diagnostics: {
    runs: () => "/api/v1/diagnostics/runs",
    run: (runId: string | number) => `/api/v1/diagnostics/runs/${runId}`,
    triggerRun: () => "/api/v1/diagnostics/run",
    schedule: () => "/api/v1/diagnostics/schedule",
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    register: () => "/api/v1/auth/register",
    login: () => "/api/v1/auth/login",
    logout: () => "/api/v1/auth/logout",
    me: () => "/api/v1/auth/me",
    changePassword: () => "/api/v1/auth/change-password",
    googleAuthorize: (state?: string) =>
      state
        ? `/api/v1/auth/google/authorize?state=${encodeURIComponent(state)}`
        : "/api/v1/auth/google/authorize",
    googleCallback: () => "/api/v1/auth/google/callback",
    // Mail-driven flows (F1). `passwordResetComplete` also redeems invitation
    // tokens — see the endpoint's docstring for why they share a route.
    passwordResetRequest: () => "/api/v1/auth/password-reset/request",
    passwordResetComplete: () => "/api/v1/auth/password-reset/complete",
    verifyEmailRequest: () => "/api/v1/auth/verify-email/request",
    verifyEmailConfirm: () => "/api/v1/auth/verify-email/confirm",
  },

  // ── Modules ──────────────────────────────────────────────────────────────
  modules: {
    me: () => "/api/v1/modules/me",
    registry: () => "/api/v1/modules/registry",
    forUser: (userId: number | string) => `/api/v1/modules/users/${userId}`,
  },
} as const;
