/**
 * @file routes.ts
 * @module frontend/src/api
 * @description Centralized REST route map. Hooks must reference these builders
 * instead of hardcoding `/api/v1/...` path literals. Enforced by
 * scripts/maintenance/audit_grids.py rule I6.
 */

/** Query parameters accepted by the analytics performers endpoint. */
export interface PerformersQuery {
  sort_by?: string;
  limit?: number;
  is_pitcher?: boolean;
}

/** Serialize a performers query into a stable, order-independent query string. */
function performersPath(params?: PerformersQuery): string {
  const base = "/api/v1/analytics/performers";
  const p = new URLSearchParams();
  if (params?.sort_by) p.set("sort_by", params.sort_by);
  if (params?.limit != null) p.set("limit", String(params.limit));
  if (params?.is_pitcher) p.set("is_pitcher", "true");
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Route builders grouped by backend domain. Add new endpoints here rather
 * than inlining path strings inside hooks.
 */
export const API_ROUTES = {
  // ── Analytics (dashboard pilot from Phase 0) ────────────────────────────
  analytics: {
    summary: () => "/api/v1/analytics/summary",
    performers: performersPath,
    leagueTrend: () => "/api/v1/analytics/trend/league",
    activity: () => "/api/v1/analytics/activity",
  },

  // ── Admin (Phase 3.a) ────────────────────────────────────────────────────
  admin: {
    kpi: () => "/api/v1/admin/kpi",
    logs: (queryString: string) => `/api/v1/admin/logs?${queryString}`,
    syncSchedule: () => "/api/v1/admin/sync/schedule",
    syncStatus: () => "/api/v1/admin/sync/status",
    syncTrigger: () => "/api/v1/admin/sync/trigger",
    usersSummary: () => "/api/v1/admin/users/summary",
    // Phase 5.8
    users: () => "/api/v1/admin/users",
    user: (userId: number | string) => `/api/v1/admin/users/${userId}`,
    userInvite: () => "/api/v1/admin/users/invite",
    // Phase 5.11
    sessions: () => "/api/v1/admin/sessions",
    session: (sessionId: string) => `/api/v1/admin/sessions/${sessionId}`,
    // Phase 5.12
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
    seasons: () => "/api/v1/admin/seasons",
    lookupInventoryStatuses: () => "/api/v1/admin/lookup/inventory-statuses",
    lookupUiQueryConfig: () => "/api/v1/admin/lookup/ui-query-config",
    aliases: (queryString: string) =>
      queryString ? `/api/v1/admin/aliases?${queryString}` : "/api/v1/admin/aliases",
    alias: (aliasId: string | number) => `/api/v1/admin/aliases/${aliasId}`,
    apiHealth: () => "/api/v1/admin/api-health",
    teams: () => "/api/v1/admin/teams",
    team: (abbrev: string) => `/api/v1/admin/teams/${abbrev}`,
    audit: () => "/api/v1/admin/audit",
    auditHistory: (limit: number) => `/api/v1/admin/audit/history?limit=${limit}`,
    auditRun: (runId: string | number) => `/api/v1/admin/audit/history/${runId}`,
  },

  // ── User preferences (per-user grid/dashboard customization) ────────────
  userPreferences: {
    grids: () => "/api/v1/user-preferences/grids",
    grid: (gridId: string) => `/api/v1/user-preferences/grids/${gridId}`,
    gridColumn: (gridId: string, columnId: string) =>
      `/api/v1/user-preferences/grids/${gridId}/columns/${columnId}`,
  },

  // ── Collection (Inventory rewrite, Phase D) ──────────────────────────────
  // The owner-scoped portfolio surface. Mounted alongside /inventory rather
  // than replacing it: the legacy inventory_* tables stay readable through the
  // soak window and are retired in Phase J.
  collection: {
    cards: (queryString?: string) =>
      queryString ? `/api/v1/collection/cards?${queryString}` : "/api/v1/collection/cards",
    card: (cardId: number | string) => `/api/v1/collection/cards/${cardId}`,
    playerCards: (playerId: number | string) =>
      `/api/v1/collection/cards?player_id=${playerId}&page_size=200`,
    sets: () => "/api/v1/collection/sets",
    statuses: () => "/api/v1/collection/statuses",
    // Phase I.2 — page G's tabs/badges and page H's dropdowns.
    types: () => "/api/v1/collection/types",
    gradingCompanies: () => "/api/v1/collection/grading-companies",
    typeCounts: (ownerId?: number) =>
      ownerId != null
        ? `/api/v1/collection/type-counts?owner_id=${ownerId}`
        : "/api/v1/collection/type-counts",
    setProgress: () => "/api/v1/collection/set-progress",
  },

  /**
   * Catalog subject layer (Inventory rewrite, Phase E).
   *
   * Reads here are open to anonymous callers — the catalog is shared reference
   * data, unlike `collection`, whose every route requires `collector`. Writes
   * are gated server-side at the handler.
   */
  catalog: {
    cardSubjects: (cardId: number | string) =>
      `/api/v1/catalog/cards/${cardId}/subjects`,
    subject: (subjectId: number | string) => `/api/v1/catalog/subjects/${subjectId}`,
    subjectTags: (subjectId: number | string) =>
      `/api/v1/catalog/subjects/${subjectId}/tags`,
    subjectTagTypes: () => "/api/v1/catalog/subject-tag-types",
    playerCards: (playerId: number | string) =>
      `/api/v1/catalog/players/${playerId}/cards`,

    // Set layer (Phase I — pages C/D/E/F). Reads are open; the server's own
    // visibility filter is what limits an anonymous caller to approved rows,
    // so there is no separate "public" route to call here.
    sets: (queryString?: string) =>
      queryString ? `/api/v1/catalog/sets?${queryString}` : "/api/v1/catalog/sets",
    set: (setId: number | string) => `/api/v1/catalog/sets/${setId}`,
    setCards: (setId: number | string) => `/api/v1/catalog/sets/${setId}/cards`,
    setManufacturers: () => "/api/v1/catalog/sets/manufacturers",
    sports: () => "/api/v1/catalog/sports",
    setTypes: () => "/api/v1/catalog/set-types",
    // Page H's card picker — free-text over the whole visible catalog, because
    // a collector knows the player, not a set id.
    cardSearch: (q: string, limit = 25) =>
      `/api/v1/catalog/cards/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    setReview: (setId: number | string) => `/api/v1/catalog/sets/${setId}/review`,
    cardReview: (cardId: number | string) => `/api/v1/catalog/cards/${cardId}/review`,
    approvalSets: (status?: string) =>
      status
        ? `/api/v1/catalog/approval-queue/sets?status=${status}`
        : "/api/v1/catalog/approval-queue/sets",
    approvalCards: (status?: string) =>
      status
        ? `/api/v1/catalog/approval-queue/cards?status=${status}`
        : "/api/v1/catalog/approval-queue/cards",
    approvalCounts: () => "/api/v1/catalog/approval-queue/counts",
  },

  /**
   * Transactions ledger and counterparties (Inventory rewrite, Phases G/I.4).
   * Every route is owner-scoped server-side and the router carries
   * `require_role("collector")`.
   */
  transactions: {
    list: (queryString?: string) =>
      queryString ? `/api/v1/transactions?${queryString}` : "/api/v1/transactions",
    detail: (id: number | string) => `/api/v1/transactions/${id}`,
    create: () => "/api/v1/transactions",
    update: (id: number | string) => `/api/v1/transactions/${id}`,
    complete: (id: number | string) => `/api/v1/transactions/${id}/complete`,
    flips: () => "/api/v1/transactions/flips",
    types: () => "/api/v1/transactions/types",
    parties: (includeInactive = false) =>
      includeInactive
        ? "/api/v1/transactions/parties?include_inactive=true"
        : "/api/v1/transactions/parties",
    party: (id: number | string) => `/api/v1/transactions/parties/${id}`,
    partyTypes: () => "/api/v1/transactions/party-types",
  },

  // ── Inventory (Phase 3.b) ────────────────────────────────────────────────
  // ── Catalog ingestion (Hydra express import, Phase H) ────────────────────
  // Everything else that lived here — cards, sets, the whole staging family —
  // went with the `inventory_*` tables in Phase J part 2. Owned cards are
  // `collection.*`, catalog sets are `catalog.*`.
  inventory: {
    teams: () => "/api/v1/inventory/teams",
    setsValidate: () => "/api/v1/inventory/sets/validate",
    setsBatchCommit: () => "/api/v1/inventory/sets/batch-commit",
    importRuns: (queryString?: string) =>
      queryString
        ? `/api/v1/inventory/import-runs?${queryString}`
        : "/api/v1/inventory/import-runs",
  },

  // ── Leaderboards (Phase 3.c) ─────────────────────────────────────────────
  leaderboard: {
    meta: () => "/api/v1/analytics/leaderboard/meta",
    dates: (season: number) =>
      `/api/v1/analytics/leaderboard/dates?season=${season}`,
    data: (queryString: string) =>
      `/api/v1/analytics/leaderboard?${queryString}`,
  },

  // ── Trends (Phase 3.c) ───────────────────────────────────────────────────
  trend: {
    delta: (queryString: string) =>
      `/api/v1/analytics/trend/delta?${queryString}`,
    dates: (season: number) =>
      `/api/v1/analytics/trend/dates?season=${season}`,
  },

  // ── Players (Phase 3.c) ──────────────────────────────────────────────────
  players: {
    list: (queryString: string) => `/api/v1/players?${queryString}`,
    meta: () => "/api/v1/players/meta",
    profile: (playerId: number | string) => `/api/v1/players/${playerId}`,
    fullProfile: (playerId: number | string) =>
      `/api/v1/players/${playerId}/full-profile`,
    career: (playerId: number | string) =>
      `/api/v1/players/${playerId}/career`,
    search: (query: string) =>
      `/api/v1/players/search?q=${encodeURIComponent(query)}`,
    mlbStats: (playerId: number | string) =>
      `/api/v1/players/${playerId}/mlb-stats`,
  },

  // ── Search (Phase 3.d) ───────────────────────────────────────────────────
  search: {
    autocomplete: (query: string) =>
      `/api/v1/players/autocomplete?q=${encodeURIComponent(query)}&limit=10`,
    results: (query: string) =>
      `/api/v1/players/search?q=${encodeURIComponent(query)}&limit=50`,
  },

  // ── Card photos (Phase 3.e) ──────────────────────────────────────────────
  // Photos hang off a collection card since Phase J part 2, so they live on
  // the collection router where the owner scope already applies.
  cardPhotos: {
    forCard: (collectionCardId: number | string) =>
      `/api/v1/collection/cards/${collectionCardId}/photos`,
    fromUrl: (collectionCardId: number | string) =>
      `/api/v1/collection/cards/${collectionCardId}/photos/from-url`,
    photo: (photoId: number) => `/api/v1/collection/photos/${photoId}`,
  },

  // ── Admin: photo review queue (Phase 3.e) ────────────────────────────────
  photoAdmin: {
    queue: () => "/api/v1/admin/photo-queue",
    queueApprove: () => "/api/v1/admin/photo-queue/approve",
    queueReject: (photoId: number) =>
      `/api/v1/admin/photo-queue/${photoId}/reject`,
    queueRejectBatch: () => "/api/v1/admin/photo-queue/reject-batch",
    history: () => "/api/v1/admin/photo-queue/history",
  },

  // ── App-wide config (Phase 3.e) ──────────────────────────────────────────
  appConfig: {
    root: () => "/api/v1/config/app",
  },

  // ── Diagnostics (co-lives with admin surface) ────────────────────────────
  diagnostics: {
    runs: () => "/api/v1/diagnostics/runs",
    run: (runId: string | number) => `/api/v1/diagnostics/runs/${runId}`,
    triggerRun: () => "/api/v1/diagnostics/run",
    schedule: () => "/api/v1/diagnostics/schedule",
  },

  // ── Auth (Phase 5.6) ─────────────────────────────────────────────────────
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
  },

  // ── Modules (Phase 5.9) ──────────────────────────────────────────────────
  modules: {
    me: () => "/api/v1/modules/me",
    registry: () => "/api/v1/modules/registry",
    forUser: (userId: number | string) => `/api/v1/modules/users/${userId}`,
  },
} as const;
