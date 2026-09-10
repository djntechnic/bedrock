import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
function useHelpConfig(topicKey) {
  const query = useQuery({
    queryKey: queryKeys.help.topic(topicKey),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.help.topic(topicKey)
      );
      return data;
    },
    staleTime: 5 * 60 * 1e3,
    enabled: Boolean(topicKey),
    retry: false
  });
  return {
    helpEntry: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch
  };
}
export {
  useHelpConfig
};
//# sourceMappingURL=useHelpConfig.js.map
