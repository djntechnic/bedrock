/**
 * @file useHelpConfig.ts
 * @module @djntechnic/bedrock-ui/hooks
 * @description Fetches in-app quick help entry config from `/api/v1/help/{topic_key}`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";

export interface HelpEntry {
  help_entry_id?: number;
  topic_key: string;
  title: string;
  body_markdown: string;
  doc_url?: string | null;
  doc_label?: string | null;
  created_at?: string;
  created_by?: string;
  modified_at?: string;
  modified_by?: string;
}

export function useHelpConfig(topicKey: string): {
  helpEntry: HelpEntry | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const query = useQuery<HelpEntry>({
    queryKey: queryKeys.help.topic(topicKey),
    queryFn: async () => {
      const { data } = await apiClient.get<HelpEntry>(
        API_ROUTES.help.topic(topicKey),
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(topicKey),
    retry: false,
  });

  return {
    helpEntry: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
