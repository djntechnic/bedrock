import { AxiosError } from "axios";
import { apiClient } from "../../api/client.js";
import { API_ROUTES } from "../../api/routes.js";
const AUTH_FLOW_PATHS = {
  acceptInvite: "/accept-invite",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password"
};
const TOKEN_PARAM = "token";
function messageFromError(err, fallback) {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
  }
  return fallback;
}
async function requestPasswordReset(email) {
  await apiClient.post(API_ROUTES.auth.passwordResetRequest(), { email });
}
async function completePasswordReset(token, newPassword) {
  await apiClient.post(API_ROUTES.auth.passwordResetComplete(), {
    token,
    new_password: newPassword
  });
}
async function requestEmailVerification() {
  await apiClient.post(API_ROUTES.auth.verifyEmailRequest());
}
async function confirmEmailVerification(token) {
  await apiClient.post(API_ROUTES.auth.verifyEmailConfirm(), { token });
}
export {
  AUTH_FLOW_PATHS,
  TOKEN_PARAM,
  completePasswordReset,
  confirmEmailVerification,
  messageFromError,
  requestEmailVerification,
  requestPasswordReset
};
//# sourceMappingURL=authFlowApi.js.map
