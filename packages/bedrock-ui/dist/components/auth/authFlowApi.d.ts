/**
 * Where the emailed links land. Mirrors the path constants in
 * `bedrock/mail/service.py`; an application wires its router to these.
 */
export declare const AUTH_FLOW_PATHS: {
    readonly acceptInvite: "/accept-invite";
    readonly resetPassword: "/reset-password";
    readonly verifyEmail: "/verify-email";
    readonly forgotPassword: "/forgot-password";
};
/** Query-string parameter carrying the token in every emailed link. */
export declare const TOKEN_PARAM = "token";
/**
 * Pull a human-usable message out of an axios failure.
 *
 * The backend's 400 for a bad token is deliberately one fixed string for
 * expired, spent, unknown and wrong-purpose, so surfacing `detail` verbatim
 * leaks nothing — and it is better copy than anything generic we would write
 * here. A network failure has no `detail`, hence the fallback.
 */
export declare function messageFromError(err: unknown, fallback: string): string;
/**
 * Ask for a reset link.
 *
 * Resolves for a registered address, an unregistered one, a deactivated
 * account, and a deployment with no mail backend — the endpoint returns 202 for
 * all four. The caller must not try to distinguish them: doing so in the UI
 * would rebuild the account-enumeration oracle the endpoint exists to avoid.
 */
export declare function requestPasswordReset(email: string): Promise<void>;
/**
 * Redeem a reset *or* invitation token and set the password.
 *
 * One call for both because the backend accepts both purposes here — choosing
 * a first password and replacing a forgotten one are the same action by
 * someone who proved control of the address.
 */
export declare function completePasswordReset(token: string, newPassword: string): Promise<void>;
/** Ask for a fresh verification link. Authenticated; sends only to the caller's own address. */
export declare function requestEmailVerification(): Promise<void>;
/** Confirm an address with the token from a verification email. Anonymous by design. */
export declare function confirmEmailVerification(token: string): Promise<void>;
