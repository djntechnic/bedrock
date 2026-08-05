/**
 * @file client.ts
 * @module frontend/src/api
 * @description Axios client configuration and common API response types.
 *              Phase 5.6 adds an in-memory Bearer token used by the auth
 *              interceptor. Token is set from `AuthContext` on login and
 *              cleared on logout; it is not persisted to storage so page
 *              refresh drops the session (mitigates XSS token theft).
 */

import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Pre-configured Axios instance for all backend communication.
 * Uses VITE_API_BASE_URL from environment variables.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let _authToken: string | null = null;

/** Set the Bearer token attached to every subsequent request. */
export function setAuthToken(token: string | null): void {
  _authToken = token;
}

/** Read the currently attached Bearer token (may be null). */
export function getAuthToken(): string | null {
  return _authToken;
}

apiClient.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.set("Authorization", `Bearer ${_authToken}`);
  }
  return config;
});

/** Generic wrapper for API responses from the FastAPI backend. */
export interface ApiResponse<T> {
  /** Success or error status string. */
  status: string;
  /** Optional message describing the result or error. */
  message?: string;
  /** The payload of the response. */
  data?: T;
}
