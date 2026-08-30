/**
 * @file client.ts
 * @module frontend/src/api
 * @description Axios client configuration and common API response types.
 *              Phase 5.6 adds an in-memory Bearer token used by the auth
 *              interceptor. Token is set from `AuthContext` on login and
 *              cleared on logout; it is not persisted to storage so page
 *              refresh drops the session (mitigates XSS token theft).
 */
/**
 * Pre-configured Axios instance for all backend communication.
 * Uses VITE_API_BASE_URL from environment variables.
 */
export declare const apiClient: import("axios").AxiosInstance;
/** Set the Bearer token attached to every subsequent request. */
export declare function setAuthToken(token: string | null): void;
/** Read the currently attached Bearer token (may be null). */
export declare function getAuthToken(): string | null;
/** Generic wrapper for API responses from the FastAPI backend. */
export interface ApiResponse<T> {
    /** Success or error status string. */
    status: string;
    /** Optional message describing the result or error. */
    message?: string;
    /** The payload of the response. */
    data?: T;
}
