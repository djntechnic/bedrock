/**
 * @file usePreviewLiveData.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Hook for fetching live backend API data for grid previews inside the Grid Editor.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../../api/client";
import type { ApiEndpointBinding } from "./apiPreviewRegistry";
import { log } from "../../../utils/logger";

export interface PreviewLiveDataState {
  rows: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export function usePreviewLiveData(
  binding: ApiEndpointBinding | null,
  params: Record<string, any>,
  enabled: boolean = true,
): PreviewLiveDataState {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!binding || !enabled) return;

    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    // Build clean query params dictionary (excluding empty/null values)
    const cleanParams: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== "" && v !== null && v !== undefined && v !== "all") {
        cleanParams[k] = v;
      }
    }

    try {
      log.debug(
        { path: binding.path, params: cleanParams },
        "usePreviewLiveData: fetching preview data",
      );

      const response = await apiClient.get(binding.path, { params: cleanParams });
      let data = response.data;

      // Unwrap envelope if responsePath is specified or if data has data key
      if (binding.responsePath && data && typeof data === "object" && binding.responsePath in data) {
        data = data[binding.responsePath];
      } else if (data && typeof data === "object" && "data" in data && Array.isArray(data.data)) {
        data = data.data;
      }

      if (Array.isArray(data)) {
        setRows(data as Record<string, unknown>[]);
      } else if (data && typeof data === "object") {
        setRows([data as Record<string, unknown>]);
      } else {
        setRows([]);
      }
    } catch (err: any) {
      setIsError(true);
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      let rawDetail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message;
      if (typeof rawDetail === "object") {
        rawDetail = rawDetail.message || rawDetail.code || JSON.stringify(rawDetail);
      }

      const queryStr =
        Object.keys(cleanParams).length > 0
          ? `?${new URLSearchParams(cleanParams).toString()}`
          : "";
      const fullUrl = `${binding.path}${queryStr}`;

      let formattedMsg: string;
      if (status === 404) {
        formattedMsg = `404 Not Found — Endpoint '${fullUrl}' does not exist on backend server.`;
      } else if (status) {
        formattedMsg = `HTTP ${status} (${statusText || "Error"}) requesting '${fullUrl}': ${rawDetail}`;
      } else {
        formattedMsg = rawDetail || `Failed to fetch live API data from '${fullUrl}'`;
      }

      setErrorMessage(formattedMsg);
      log.warn({ path: binding.path, status, error: formattedMsg }, "usePreviewLiveData: fetch error");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [binding, JSON.stringify(params), enabled]);

  useEffect(() => {
    if (enabled && binding) {
      fetchData();
    }
  }, [enabled, binding?.id, JSON.stringify(params), fetchData]);

  return {
    rows,
    isLoading,
    isError,
    errorMessage,
    refetch: fetchData,
  };
}
