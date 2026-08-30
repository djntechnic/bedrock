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
export declare const queryKeys: {
    readonly admin: {
        /** Root key — invalidates every admin query, including an app's own. */
        readonly all: readonly ["admin"];
        readonly logs: (params: unknown) => readonly ["admin", "logs", unknown];
        readonly syncSchedule: () => readonly ["admin", "sync_schedule"];
        readonly syncStatus: () => readonly ["admin", "sync_status"];
        readonly usersSummary: () => readonly ["admin", "users_summary"];
        readonly users: () => readonly ["admin", "users"];
        readonly user: (userId: number | string) => readonly ["admin", "user", string | number];
        readonly sessions: () => readonly ["admin", "sessions"];
        readonly securityEvents: (params: unknown) => readonly ["admin", "security_events", unknown];
        readonly dbSummary: () => readonly ["admin", "db_summary"];
        readonly config: (category?: string) => readonly ["admin", "config"] | readonly ["admin", "config", string];
        /** Broad prefix used by invalidateQueries after a create/update/delete. */
        readonly configAll: () => readonly ["admin", "config"];
        readonly grids: () => readonly ["admin", "grids"];
        readonly gridPages: () => readonly ["admin", "grid_pages"];
        readonly gridColumns: (gridId: string | null) => readonly ["admin", "grid_columns", string | null];
        /** Broad prefix — invalidates every grid_columns cache. */
        readonly gridColumnsAll: () => readonly ["admin", "grid_columns"];
        readonly exports: () => readonly ["admin", "exports"];
        readonly lookupUiQueryConfig: () => readonly ["admin", "lookup", "ui_query_config"];
        /** Broad prefix — invalidates every lookup-table cache, an app's included. */
        readonly lookupAll: () => readonly ["admin", "lookup"];
        readonly apiHealth: () => readonly ["admin", "api_health"];
        readonly health: () => readonly ["health"];
        readonly audit: () => readonly ["admin", "audit"];
        readonly auditHistory: (limit: number) => readonly ["admin", "audit-history", number];
        /** Broad prefix — invalidates every audit-history page regardless of limit. */
        readonly auditHistoryAll: () => readonly ["admin", "audit-history"];
        readonly auditRun: (runId: string | number) => readonly ["admin", "audit-run", string | number];
    };
    readonly appConfig: {
        readonly all: readonly ["app_config"];
    };
    readonly diagnostics: {
        readonly all: readonly ["diagnostics"];
        readonly runs: () => readonly ["diagnostics", "runs"];
        readonly run: (runId: string | number) => readonly ["diagnostics", "run", string | number];
        readonly schedule: () => readonly ["diagnostics", "schedule"];
    };
    readonly auth: {
        readonly all: readonly ["auth"];
        readonly me: () => readonly ["auth", "me"];
    };
    readonly userPreferences: {
        /** Root key — invalidates every user-preferences query. */
        readonly all: readonly ["user_preferences"];
        readonly grids: () => readonly ["user_preferences", "grids"];
        readonly grid: (gridId: string) => readonly ["user_preferences", "grids", string];
    };
    readonly modules: {
        readonly all: readonly ["modules"];
        readonly list: () => readonly ["modules", "list"];
        /** Token-scoped cache so login/logout invalidates the anon set cleanly. */
        readonly me: (token: string | null) => readonly ["modules", "me", string];
        readonly registry: () => readonly ["modules", "registry"];
        readonly forUser: (userId: number | string) => readonly ["modules", "user", string | number];
    };
    readonly navigation: {
        readonly all: readonly ["navigation"];
        readonly settings: () => readonly ["navigation", "settings"];
    };
    readonly security: {
        readonly all: readonly ["security"];
        readonly matrix: () => readonly ["security", "matrix"];
        readonly roles: () => readonly ["security", "roles"];
        readonly role: (roleId: number | string) => readonly ["security", "role", string | number];
        readonly myPermissions: (token: string | null) => readonly ["security", "myPermissions", string];
        readonly userOverrides: (userId: number | string) => readonly ["security", "userOverrides", string | number];
        readonly userProfile: (userId: number | string) => readonly ["security", "userProfile", string | number];
    };
};
