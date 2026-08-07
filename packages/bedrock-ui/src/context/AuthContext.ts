/**
 * @file AuthContext.ts
 * @module frontend/src/context
 * @description Phase 5.6 — React context carrying the authenticated user,
 *              JWT token, and login/logout actions. The provider lives in
 *              `AuthProvider.tsx`; consumers should use `useAuth()` from
 *              `@/hooks/useAuth` rather than importing the raw context.
 */
import { createContext } from "react";

export interface UserProfile {
  user_id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_superuser: boolean;
  roles: string[];
  created_at: string;
  last_login_at: string | null;
}

export interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /**
   * Role predicate. Every role except `admin` is checked through here —
   * `isCollector` used to sit alongside `isAdmin` and was a baseball-shaped
   * role hardcoded into a platform interface, which is one app's vocabulary
   * every other consumer would inherit. `hasRole("collector")` reads the same
   * and generalises.
   *
   * `isAdmin` stays as a field because the platform itself branches on it —
   * `ProtectedRoute` treats admin as satisfying every role and module check.
   */
  hasRole: (slug: string) => boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  loginWithGoogle: (returnTo?: string, rememberMe?: boolean) => void;
  completeGoogleLogin: (code: string, state?: string | null) => Promise<UserProfile>;
  logout: () => Promise<void>;
  setSession: (token: string, user: UserProfile, rememberMe?: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
