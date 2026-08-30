import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { log } from "../utils/logger.js";
function useChangePassword() {
  return useMutation({
    mutationFn: async (input) => {
      await apiClient.post(API_ROUTES.auth.changePassword(), input);
    },
    onSuccess: () => {
      log.info("Password changed");
    }
  });
}
export {
  useChangePassword
};
//# sourceMappingURL=useProfile.js.map
