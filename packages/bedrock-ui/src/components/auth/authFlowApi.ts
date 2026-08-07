/**
 * @file authFlowApi.ts
 * @module @djntechnic/bedrock-ui/components/auth
 * @description The four calls behind the mail-driven auth flows (plan F1), and
 *              the route paths the emailed links point at.
 *
 * The paths are constants rather than props because the *backend* builds the
 * links: `bedrock.mail.service` hardcodes `/accept-invite`, `/reset-password`
 * and `/verify-email`, appends `?token=…`, and mails the result. If an app
 * mounted these pages somewhere else, every link already sent would 404. Both
 * halves reading one constant is what keeps that from drifting — change it
 * here and in `service.py` together, or not at all.
 *
 * These are plain async functions rather than TanStack mutations. Each one is
 * fired once, from a page that owns nothing else, and none of them has a cache
 * entry to invalidate — a query client would be ceremony around a POST.
 */
import { AxiosError } from "axios";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../api/routes";

/**
 * Where the emailed links land. Mirrors the path constants in
 * `bedrock/mail/service.py`; an application wires its router to these.
 */
export const AUTH_FLOW_PATHS = {
  acceptInvite: "/accept-invite",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
} as const;

/** Query-string parameter carrying the token in every emailed link. */
export const TOKEN_PARAM = "token";

/**
 * Pull a human-usable message out of an axios failure.
 *
 * The backend's 400 for a bad token is deliberately one fixed string for
 * expired, spent, unknown and wrong-purpose, so surfacing `detail` verbatim
 * leaks nothing — and it is better copy than anything generic we would write
 * here. A network failure has no `detail`, hence the fallback.
 */
export function messageFromError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
  }
  return fallback;
}

/**
 * Ask for a reset link.
 *
 * Resolves for a registered address, an unregistered one, a deactivated
 * account, and a deployment with no mail backend — the endpoint returns 202 for
 * all four. The caller must not try to distinguish them: doing so in the UI
 * would rebuild the account-enumeration oracle the endpoint exists to avoid.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post(API_ROUTES.auth.passwordResetRequest(), { email });
}

/**
 * Redeem a reset *or* invitation token and set the password.
 *
 * One call for both because the backend accepts both purposes here — choosing
 * a first password and replacing a forgotten one are the same action by
 * someone who proved control of the address.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post(API_ROUTES.auth.passwordResetComplete(), {
    token,
    new_password: newPassword,
  });
}

/** Ask for a fresh verification link. Authenticated; sends only to the caller's own address. */
export async function requestEmailVerification(): Promise<void> {
  await apiClient.post(API_ROUTES.auth.verifyEmailRequest());
}

/** Confirm an address with the token from a verification email. Anonymous by design. */
export async function confirmEmailVerification(token: string): Promise<void> {
  await apiClient.post(API_ROUTES.auth.verifyEmailConfirm(), { token });
}
