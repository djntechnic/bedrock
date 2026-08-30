import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { getHookConfig } from "./useAppConfig.js";
import { queryKeys } from "./queryKeys.js";
import { useAppConfigContext } from "../context/AppConfigContext.js";
function useLogs(params) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useLogs", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.logs(params),
    queryFn: async () => {
      const p = new URLSearchParams();
      if (params?.source && params.source !== "all")
        p.set("source", params.source);
      if (params?.event_type) p.set("event_type", params.event_type);
      if (params?.date_from) p.set("date_from", params.date_from);
      if (params?.date_to) p.set("date_to", params.date_to);
      if (params?.limit) p.set("limit", String(params.limit));
      const { data } = await apiClient.get(API_ROUTES.admin.logs(p.toString()));
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useUserSummary() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useUserSummary", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.usersSummary(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.usersSummary());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useDbSummary() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useDbSummary", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.dbSummary(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.databaseSummary());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useCreateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await apiClient.post(API_ROUTES.admin.config(), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() });
    }
  });
}
function useDeleteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key) => {
      const { data } = await apiClient.delete(API_ROUTES.admin.configItem(key));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() });
    }
  });
}
function useConfigSettings(category) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useConfigSettings", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.config(category),
    queryFn: async () => {
      const p = category ? `?category=${category}` : "";
      const { data } = await apiClient.get(`${API_ROUTES.admin.config()}${p}`);
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useGridSettings() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridSettings", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.grids(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.grids());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useGridPages() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridSettings", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.gridPages(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.gridPages());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useGridColumns(gridId) {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useGridColumns", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.gridColumns(gridId),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.gridColumns(gridId));
      return data;
    },
    enabled: gridId !== null,
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useExportHistory() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useExportHistory", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.exports(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.exports());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...updates }) => {
      const body = {};
      if (updates.value !== void 0) body.value = updates.value;
      if (updates.value_type !== void 0) body.value_type = updates.value_type;
      if (updates.description !== void 0) body.description = updates.description;
      if (updates.category !== void 0) body.category = updates.category;
      if (updates.newKey !== void 0) body.key = updates.newKey;
      const { data } = await apiClient.patch(API_ROUTES.admin.configItem(key), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.configAll() });
    }
  });
}
function useUpdateGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      columnId,
      updates
    }) => {
      const { data } = await apiClient.patch(API_ROUTES.admin.gridColumn(gridId, columnId), updates);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    }
  });
}
function useCreateGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      seed
    }) => {
      const { data } = await apiClient.post(
        API_ROUTES.admin.gridColumns(gridId),
        seed
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    }
  });
}
function useDeleteGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      columnId
    }) => {
      const { data } = await apiClient.delete(
        API_ROUTES.admin.gridColumn(gridId, columnId)
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
    }
  });
}
function useUpdateGridSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      updates
    }) => {
      const { data } = await apiClient.patch(API_ROUTES.admin.grid(gridId), updates);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.grids() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.gridColumnsAll() });
    }
  });
}
function useLogExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(API_ROUTES.admin.exportsLog(), payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.exports() });
    }
  });
}
function useAdmin() {
  const { mutate: logExport } = useLogExport();
  return { logExport };
}
function useHealthCheck() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useHealthCheck", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: async () => {
      const { data } = await apiClient.get("/api/v1/health");
      return data;
    },
    refetchInterval: cfg.refetchInterval ?? 3e4
  });
}
function useInvalidateDiagnosticRuns() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.diagnostics.runs() });
  };
}
function useApiHealth() {
  const appConfig = useAppConfigContext();
  const cfg = getHookConfig("useApiHealth", appConfig);
  return useQuery({
    queryKey: queryKeys.admin.apiHealth(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.apiHealth());
      return data;
    },
    staleTime: cfg.staleTime,
    refetchInterval: cfg.refetchInterval ?? void 0,
    refetchOnWindowFocus: cfg.refetchOnWindowFocus
  });
}
function useDiagnosticRuns() {
  return useQuery({
    queryKey: queryKeys.diagnostics.runs(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.runs());
      return data;
    },
    staleTime: 1e3 * 30
  });
}
function useDiagnosticRun(runId) {
  return useQuery({
    queryKey: queryKeys.diagnostics.run(runId),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.run(runId));
      return data;
    },
    enabled: runId != null,
    staleTime: 1e3 * 30
  });
}
function useTriggerDiagnosticRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(API_ROUTES.diagnostics.triggerRun());
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.diagnostics.all });
    }
  });
}
function useDiagnosticSchedule() {
  return useQuery({
    queryKey: queryKeys.diagnostics.schedule(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.diagnostics.schedule());
      return data;
    },
    staleTime: 1e3 * 60 * 5
  });
}
function useUpdateDiagnosticSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await apiClient.patch(API_ROUTES.diagnostics.schedule(), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.diagnostics.schedule() });
    }
  });
}
function useAuditResults(enabled) {
  return useQuery({
    queryKey: queryKeys.admin.audit(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.audit());
      return data;
    },
    enabled,
    staleTime: 0,
    gcTime: 0
  });
}
function useAuditHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.admin.auditHistory(limit),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.auditHistory(limit));
      return data;
    },
    staleTime: 3e4
  });
}
function useAuditRunDetail(runId) {
  return useQuery({
    queryKey: queryKeys.admin.auditRun(runId ?? -1),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.admin.auditRun(runId));
      return data;
    },
    enabled: runId != null,
    staleTime: 0
  });
}
function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.admin.users()
      );
      return data;
    },
    staleTime: 3e4,
    refetchOnWindowFocus: false
  });
}
function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      payload
    }) => {
      const { data } = await apiClient.patch(
        API_ROUTES.admin.user(userId),
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.usersSummary() });
    }
  });
}
function useInviteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(
        API_ROUTES.admin.userInvite(),
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      qc.invalidateQueries({ queryKey: queryKeys.admin.usersSummary() });
    }
  });
}
function useAdminSessions() {
  return useQuery({
    queryKey: queryKeys.admin.sessions(),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.admin.sessions()
      );
      return data;
    },
    staleTime: 3e4,
    refetchOnWindowFocus: false
  });
}
function useRevokeAdminSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId) => {
      await apiClient.delete(API_ROUTES.admin.session(sessionId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.sessions() });
    }
  });
}
function useSecurityEvents(params) {
  return useQuery({
    queryKey: queryKeys.admin.securityEvents(params),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params.event_type) qs.set("event_type", params.event_type);
      if (params.user_id != null) qs.set("user_id", String(params.user_id));
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.offset != null) qs.set("offset", String(params.offset));
      const { data } = await apiClient.get(
        API_ROUTES.admin.securityEvents(qs.toString() || void 0)
      );
      return data;
    },
    staleTime: 15e3,
    refetchOnWindowFocus: false
  });
}
export {
  useAdmin,
  useAdminSessions,
  useAdminUsers,
  useApiHealth,
  useAuditHistory,
  useAuditResults,
  useAuditRunDetail,
  useConfigSettings,
  useCreateConfig,
  useCreateGridColumn,
  useDbSummary,
  useDeleteConfig,
  useDeleteGridColumn,
  useDiagnosticRun,
  useDiagnosticRuns,
  useDiagnosticSchedule,
  useExportHistory,
  useGridColumns,
  useGridPages,
  useGridSettings,
  useHealthCheck,
  useInvalidateDiagnosticRuns,
  useInviteAdminUser,
  useLogExport,
  useLogs,
  useRevokeAdminSession,
  useSecurityEvents,
  useTriggerDiagnosticRun,
  useUpdateAdminUser,
  useUpdateConfig,
  useUpdateDiagnosticSchedule,
  useUpdateGridColumn,
  useUpdateGridSetting,
  useUserSummary
};
//# sourceMappingURL=useAdminPlatform.js.map
