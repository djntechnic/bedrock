import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../../../api/client.js";
import { log } from "../../../utils/logger.js";
function usePreviewLiveData(binding, params, enabled = true) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const fetchData = useCallback(async () => {
    if (!binding || !enabled) return;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== "" && v !== null && v !== void 0 && v !== "all") {
        cleanParams[k] = v;
      }
    }
    try {
      log.debug(
        { path: binding.path, params: cleanParams },
        "usePreviewLiveData: fetching preview data"
      );
      const response = await apiClient.get(binding.path, { params: cleanParams });
      let data = response.data;
      if (binding.responsePath && data && typeof data === "object" && binding.responsePath in data) {
        data = data[binding.responsePath];
      } else if (data && typeof data === "object" && "data" in data && Array.isArray(data.data)) {
        data = data.data;
      }
      if (Array.isArray(data)) {
        setRows(data);
      } else if (data && typeof data === "object") {
        setRows([data]);
      } else {
        setRows([]);
      }
    } catch (err) {
      setIsError(true);
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      let rawDetail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message;
      if (typeof rawDetail === "object") {
        rawDetail = rawDetail.message || rawDetail.code || JSON.stringify(rawDetail);
      }
      const queryStr = Object.keys(cleanParams).length > 0 ? `?${new URLSearchParams(cleanParams).toString()}` : "";
      const fullUrl = `${binding.path}${queryStr}`;
      let formattedMsg;
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
    refetch: fetchData
  };
}
export {
  usePreviewLiveData
};
//# sourceMappingURL=usePreviewLiveData.js.map
