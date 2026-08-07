/**
 * @file queryKeys.ts
 * @module frontend/src/hooks
 * @description Centralized TanStack Query key factory. Hooks must derive their
 * `queryKey` from these builders instead of inlining string arrays. Enforced
 * by scripts/maintenance/audit_grids.py rule I5.
 *
 * Key shapes are preserved from the legacy inline keys so existing caches
 * remain addressable during the Phase 3 domain-by-domain migration.
 */

/**
 * Query key builders grouped by backend domain. Every hook file
 * (frontend/src/hooks/**) must reference one of these builders.
 */
export const queryKeys = {
  // ── Analytics (dashboard pilot from Phase 0) ────────────────────────────
  analytics: {
    /** Root key — invalidates every analytics query. */
    all: ["analytics"] as const,
    summary: () => ["analytics", "summary"] as const,
    /** Top-performers grid key (no league dimension). */
    performers: (sort_by: string, limit: number | undefined, is_pitcher: boolean) =>
      ["analytics", "performers", sort_by, limit, is_pitcher] as const,
    /** Top-leaders card key (carries an optional league dimension). */
    topLeaders: (
      sort_by: string,
      limit: number,
      is_pitcher: boolean,
      league?: string,
    ) => ["analytics", "performers", sort_by, limit, is_pitcher, league] as const,
    leagueTrend: () => ["analytics", "trend", "league"] as const,
    activity: () => ["analytics", "activity"] as const,
  },

  // ── Admin (Phase 3.a) ────────────────────────────────────────────────────
  admin: {
    /** Root key — invalidates every admin query. */
    all: ["admin"] as const,
    kpi: () => ["admin", "kpi"] as const,
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
    seasons: () => ["admin", "seasons"] as const,
    lookupInventoryStatuses: () =>
      ["admin", "lookup", "inventory_statuses"] as const,
    lookupUiQueryConfig: () => ["admin", "lookup", "ui_query_config"] as const,
    /** Broad prefix — invalidates every lookup-table cache. */
    lookupAll: () => ["admin", "lookup"] as const,
    aliases: (params: unknown) => ["admin", "aliases", params] as const,
    aliasesAll: () => ["admin", "aliases"] as const,
    apiHealth: () => ["admin", "api_health"] as const,
    health: () => ["health"] as const,
    teams: () => ["admin", "teams"] as const,
    teamsAll: () => ["admin", "teams"] as const,
    audit: () => ["admin", "audit"] as const,
    auditHistory: (limit: number) => ["admin", "audit-history", limit] as const,
    /** Broad prefix — invalidates every audit-history page regardless of limit. */
    auditHistoryAll: () => ["admin", "audit-history"] as const,
    auditRun: (runId: string | number) =>
      ["admin", "audit-run", runId] as const,
  },

  // ── Inventory (Phase 3.b) ────────────────────────────────────────────────
  inventory: {
    /** Root key — invalidates every inventory query. */
    all: ["inventory"] as const,
    /** Card list — with arbitrary filter params. */
    cards: (params?: unknown) =>
      params === undefined
        ? (["inventory", "cards"] as const)
        : (["inventory", "cards", params] as const),
    /** Broad prefix for cards invalidation. */
    cardsAll: () => ["inventory", "cards"] as const,
    /** Single card detail. */
    card: (cardId: number | null) => ["inventory", "card", cardId] as const,
    /** All cards owned by a specific player. */
    playerCards: (playerId: number | null) =>
      ["inventory", "player", playerId] as const,
    /** Staging domain root — invalidates every staging query. */
    staging: () => ["inventory", "staging"] as const,
    stagingBatches: () => ["inventory", "staging", "batches"] as const,
    stagingRows: (batchId: string | null) =>
      ["inventory", "staging", "rows", batchId] as const,
    /** Broad prefix — invalidates every staging-rows cache regardless of batch. */
    stagingRowsAll: () => ["inventory", "staging", "rows"] as const,
    stagingSummary: () => ["inventory", "staging", "summary"] as const,
    stagingManifest: (batchId: string | null) =>
      ["inventory", "staging", "manifest", batchId] as const,
    sets: (approvedOnly?: boolean) =>
      approvedOnly === undefined
        ? (["inventory", "sets"] as const)
        : (["inventory", "sets", approvedOnly] as const),
    setsAll: () => ["inventory", "sets"] as const,
    teams: () => ["inventory", "teams"] as const,
    uploadProgress: (batchId: string | null) =>
      ["inventory", "upload-progress", batchId] as const,
    /** Import history (Phase H, Screen O) — one key per filter combination. */
    importRuns: (filters?: unknown) =>
      filters === undefined
        ? (["inventory", "import-runs"] as const)
        : (["inventory", "import-runs", filters] as const),
    /** Broad prefix — invalidated by every successful batch commit. */
    importRunsAll: () => ["inventory", "import-runs"] as const,
  },

  // ── Catalog set layer (Inventory rewrite, Phase I — pages C/D/E/F) ───────
  //
  // A domain of its own rather than a branch of `inventory`: these keys index
  // `checklist_sets`, while `inventory.sets` still indexes the legacy
  // `inventory_sets` that Phase J drops. Sharing a prefix would make one
  // surface's invalidation silently refetch the other's.
  catalog: {
    /** Root key — invalidates every catalog query. */
    all: ["catalog"] as const,
    /** Set browse list — one key per filter combination (page C). */
    sets: (filters?: unknown) =>
      filters === undefined
        ? (["catalog", "sets"] as const)
        : (["catalog", "sets", filters] as const),
    /** Broad prefix — invalidated by any set write or review. */
    setsAll: () => ["catalog", "sets"] as const,
    /** One set's header (page D). */
    set: (setId: number | null) => ["catalog", "set", setId] as const,
    /** One set's checklist cards (page D). */
    setCards: (setId: number | null) => ["catalog", "set-cards", setId] as const,
    manufacturers: () => ["catalog", "manufacturers"] as const,
    sports: () => ["catalog", "sports"] as const,
    setTypes: () => ["catalog", "set-types"] as const,
    /** Approval queue, keyed by level and status (page F). */
    approval: (level: "sets" | "cards", status?: string) =>
      ["catalog", "approval", level, status ?? "pending"] as const,
    /** Broad prefix — invalidated by every approve/reject. */
    approvalAll: () => ["catalog", "approval"] as const,
    approvalCounts: () => ["catalog", "approval-counts"] as const,
    /** Page H's card picker, keyed by the search text. */
    cardSearch: (q: string) => ["catalog", "card-search", q] as const,
  },

  // ── Collection (Inventory rewrite, Phase I.2 — pages G/H/I/N) ────────────
  //
  // Separate from `inventory`: these index `collection_cards`, while
  // `inventory.cards` still indexes the legacy-compatible projection the old
  // Inventory page renders. Sharing a prefix would make one surface's
  // invalidation refetch the other's.
  collection: {
    all: ["collection"] as const,
    /** Owner-scoped card list — one key per filter combination (page G). */
    cards: (filters?: unknown) =>
      filters === undefined
        ? (["collection", "cards"] as const)
        : (["collection", "cards", filters] as const),
    /** Broad prefix — invalidated by every collection write. */
    cardsAll: () => ["collection", "cards"] as const,
    card: (cardId: number | null) => ["collection", "card", cardId] as const,
    /** Tracked sets with completion progress (page I). */
    sets: () => ["collection", "sets"] as const,
    /** Page I — union of tracked and owned-derived sets. */
    setProgress: () => ["collection", "set-progress"] as const,
    /** Owner-scoped per-type counts — page G's tab badges. */
    /** Owner-scoped per-type counts — page G's tab badges.
     *  Keyed on the target so page N switching users cannot read the previous
     *  user's badge counts out of the cache. */
    typeCounts: (ownerId?: number) =>
      ownerId === undefined
        ? (["collection", "type-counts", "self"] as const)
        : (["collection", "type-counts", ownerId] as const),
    /** Broad prefix — a write must invalidate every owner's counts, not just
     *  the caller's own, because page N writes against someone else's. */
    typeCountsAll: () => ["collection", "type-counts"] as const,
    types: () => ["collection", "types"] as const,
    gradingCompanies: () => ["collection", "grading-companies"] as const,
    statuses: () => ["collection", "statuses"] as const,
  },

  // ── Transactions (Inventory rewrite, Phase I.4 — pages J/K/L/M) ─────────
  transactions: {
    all: ["transactions"] as const,
    /** Ledger list — one key per filter combination (page J). */
    list: (filters?: unknown) =>
      filters === undefined
        ? (["transactions", "list"] as const)
        : (["transactions", "list", filters] as const),
    /** Broad prefix — invalidated by every ledger write. */
    listAll: () => ["transactions", "list"] as const,
    detail: (id: number | null) => ["transactions", "detail", id] as const,
    /** `v_transactions_flips` — page J's Flips toggle. */
    flips: () => ["transactions", "flips"] as const,
    types: () => ["transactions", "types"] as const,
    parties: (includeInactive = false) =>
      ["transactions", "parties", includeInactive] as const,
    /** Broad prefix — invalidated by every party write. */
    partiesAll: () => ["transactions", "parties"] as const,
    party: (id: number | null) => ["transactions", "party", id] as const,
    partyTypes: () => ["transactions", "party-types"] as const,
  },

  // ── Leaderboards (Phase 3.c) ─────────────────────────────────────────────
  leaderboard: {
    all: ["leaderboard"] as const,
    meta: () => ["leaderboard", "meta"] as const,
    dates: (season: number) => ["leaderboard", "dates", season] as const,
    data: (season: number, isPitcher: boolean, snapshotDate: string | null) =>
      ["leaderboard", "data", season, isPitcher, snapshotDate] as const,
  },

  // ── Trends (Phase 3.c) ───────────────────────────────────────────────────
  trend: {
    all: ["trend"] as const,
    delta: (
      seasonB: number,
      dateB: string | null,
      seasonA: number,
      dateA: string | null,
      isPitcher: boolean,
    ) => ["trend", "delta", seasonB, dateB, seasonA, dateA, isPitcher] as const,
    dates: (season: number) => ["trend", "dates", season] as const,
  },

  // ── Players (Phase 3.c) ──────────────────────────────────────────────────
  players: {
    all: ["players"] as const,
    list: (
      page: number,
      pageSize: number,
      status: string | undefined,
      team: string | undefined,
      org: string | undefined,
      search: string | undefined,
      level: string | undefined,
      currentSeasonOnly: boolean | undefined,
    ) =>
      [
        "players",
        "list",
        page,
        pageSize,
        status,
        team,
        org,
        search,
        level,
        currentSeasonOnly,
      ] as const,
    meta: () => ["players", "meta"] as const,
    profile: (playerId: number | null) =>
      ["players", "profile", playerId] as const,
    fullProfile: (playerId: number | null) =>
      ["players", "full-profile", playerId] as const,
    career: (playerId: number | null) =>
      ["players", "career", playerId] as const,
    search: (query: string) => ["players", "search", query] as const,
    mlbStats: (playerId: number | null) =>
      ["players", "mlb-stats", playerId] as const,
  },

  // ── Rankings (Phase 3.d) ─────────────────────────────────────────────────
  rankings: {
    all: ["rankings"] as const,
    data: (params: unknown) => ["rankings", "data", params] as const,
    playerHistory: (mlbId: number | undefined, days: number) =>
      ["rankings", "player-history", mlbId, days] as const,
    configSources: () => ["rankings", "config", "sources"] as const,
    configWeights: (type: "hitter" | "pitcher" | undefined) =>
      ["rankings", "config", "weights", type] as const,
    configWeightsAll: () => ["rankings", "config", "weights"] as const,
    configAlerts: () => ["rankings", "config", "alerts"] as const,
    syncHistory: (limit: number) => ["rankings", "sync-history", limit] as const,
    syncHistoryAll: () => ["rankings", "sync-history"] as const,
  },

  // ── Search (Phase 3.d) ───────────────────────────────────────────────────
  search: {
    all: ["search"] as const,
    autocomplete: (query: string) => ["search", "autocomplete", query] as const,
    results: (query: string) => ["search", "results", query] as const,
  },

  // ── Card photos (Phase 3.e) ──────────────────────────────────────────────
  cardPhotos: {
    all: ["card-photos"] as const,
    forCard: (cardId: number) => ["card-photos", cardId] as const,
  },

  // ── Admin: photo review queue (Phase 3.e) ────────────────────────────────
  photoAdmin: {
    queue: () => ["admin", "photo-queue"] as const,
    history: (limit: number) => ["admin", "photo-history", limit] as const,
    historyAll: () => ["admin", "photo-history"] as const,
  },

  // ── App-wide config (Phase 3.e) ──────────────────────────────────────────
  appConfig: {
    all: ["app_config"] as const,
  },

  // ── Diagnostics (co-lives with admin surface) ────────────────────────────
  diagnostics: {
    all: ["diagnostics"] as const,
    runs: () => ["diagnostics", "runs"] as const,
    run: (runId: string | number) => ["diagnostics", "run", runId] as const,
    schedule: () => ["diagnostics", "schedule"] as const,
  },

  // ── Auth (Phase 5.6) ─────────────────────────────────────────────────────
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },

  // ── User preferences (per-user grid/dashboard customization) ────────────
  userPreferences: {
    /** Root key — invalidates every user-preferences query. */
    all: ["user_preferences"] as const,
    grids: () => ["user_preferences", "grids"] as const,
    grid: (gridId: string) => ["user_preferences", "grids", gridId] as const,
  },

  // ── Modules (Phase 5.9) ──────────────────────────────────────────────────
  modules: {
    all: ["modules"] as const,
    /** Token-scoped cache so login/logout invalidates the anon set cleanly. */
    me: (token: string | null) => ["modules", "me", token ?? "anon"] as const,
    registry: () => ["modules", "registry"] as const,
    forUser: (userId: number | string) => ["modules", "user", userId] as const,
  },
} as const;
