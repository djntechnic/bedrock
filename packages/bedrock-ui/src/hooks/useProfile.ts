/**
 * @file useProfile.ts
 * @module @djntechnic/bedrock-ui/hooks
 * @description The signed-in operator's own account operations.
 *
 * The platform has served `POST /auth/change-password` since auth landed; the
 * mutation for it lived in every consumer instead of here, which is the same
 * gap `<ProfilePage>` closes on the screen side.
 */
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { log } from "../utils/logger";

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
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      await apiClient.post(API_ROUTES.auth.changePassword(), input);
    },
    onSuccess: () => {
      // No identifying detail: this line reaches the browser console, and the
      // useful fact is that the write happened at all.
      log.info("Password changed");
    },
  });
}
