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
export declare const API_ROUTES: {
    readonly admin: {
        readonly logs: (queryString: string) => string;
        readonly syncSchedule: () => string;
        readonly syncStatus: () => string;
        readonly usersSummary: () => string;
        readonly users: () => string;
        readonly user: (userId: number | string) => string;
        readonly userInvite: () => string;
        readonly sessions: () => string;
        readonly session: (sessionId: string) => string;
        readonly securityEvents: (qs?: string) => string;
        readonly databaseSummary: () => string;
        readonly config: (category?: string) => string;
        readonly configItem: (key: string) => string;
        readonly grids: () => string;
        readonly gridPages: () => string;
        readonly gridColumns: (gridId: string) => string;
        readonly gridColumn: (gridId: string, columnId: string) => string;
        readonly grid: (gridId: string) => string;
        readonly exports: () => string;
        readonly exportsLog: () => string;
        readonly lookupUiQueryConfig: () => string;
        readonly apiHealth: () => string;
        readonly audit: () => string;
        readonly auditHistory: (limit: number) => string;
        readonly auditRun: (runId: string | number) => string;
    };
    readonly userPreferences: {
        readonly grids: () => string;
        readonly grid: (gridId: string) => string;
        readonly gridColumn: (gridId: string, columnId: string) => string;
    };
    readonly appConfig: {
        readonly root: () => string;
    };
    readonly diagnostics: {
        readonly runs: () => string;
        readonly run: (runId: string | number) => string;
        readonly triggerRun: () => string;
        readonly schedule: () => string;
    };
    readonly auth: {
        readonly register: () => string;
        readonly login: () => string;
        readonly logout: () => string;
        readonly me: () => string;
        readonly changePassword: () => string;
        readonly googleAuthorize: (state?: string) => string;
        readonly googleCallback: () => string;
        readonly passwordResetRequest: () => string;
        readonly passwordResetComplete: () => string;
        readonly verifyEmailRequest: () => string;
        readonly verifyEmailConfirm: () => string;
    };
    readonly modules: {
        readonly list: () => string;
        readonly me: () => string;
        readonly registry: () => string;
        readonly forUser: (userId: number | string) => string;
    };
    readonly navigation: {
        readonly settings: () => string;
        readonly setting: (navKey: string) => string;
    };
    readonly security: {
        readonly matrix: () => string;
        readonly roles: () => string;
        readonly role: (roleId: number | string) => string;
        readonly myPermissions: () => string;
        readonly userOverrides: (userId: number | string) => string;
        readonly userProfile: (userId: number | string) => string;
    };
};
