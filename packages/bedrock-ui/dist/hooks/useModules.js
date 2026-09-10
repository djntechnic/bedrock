import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
import { useAuth } from "./useAuth.js";
function useModules() {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.modules.me(token),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.modules.me()
      );
      return data;
    },
    staleTime: 1e3 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 3;
    }
  });
  const modules = useMemo(
    () => new Set(query.data?.modules ?? []),
    [query.data?.modules]
  );
  return {
    modules,
    hasModule: (slug) => modules.has(slug),
    authenticated: query.data?.authenticated ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch
  };
}
export {
  useModules
};
//# sourceMappingURL=useModules.js.map
