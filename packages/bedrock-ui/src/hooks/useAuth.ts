/**
 * @file useAuth.ts
 * @module frontend/src/hooks
 * @description Phase 5.6 — convenience hook returning the AuthContext value.
 *              Throws if used outside `<AuthProvider>` so a missing provider
 *              is caught at render time rather than surfacing as a silent
 *              `null` deref.
 */
import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "../context/AuthContext";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
