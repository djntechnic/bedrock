/** Exactly the body `ChangePasswordIn` accepts — 8..128 for the new one. */
export interface ChangePasswordInput {
    current_password: string;
    new_password: string;
}
/**
 * Change the current user's password.
 *
 * The endpoint answers `204 No Content` on success and `401` when the current
 * password does not match, which is the only failure a form need distinguish:
 * everything else is a server fault and reads as one.
 */
export declare function useChangePassword(): import("@tanstack/react-query").UseMutationResult<void, Error, ChangePasswordInput, unknown>;
