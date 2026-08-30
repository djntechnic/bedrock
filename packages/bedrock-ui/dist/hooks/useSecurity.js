import { jsx, Fragment } from "react/jsx-runtime";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
import { useAuth } from "./useAuth.js";
function useSecurity() {
  const { token, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.security.myPermissions(token),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.security.myPermissions()
      );
      return data;
    },
    staleTime: 1e3 * 60 * 5,
    refetchOnWindowFocus: false
  });
  const permissions = useMemo(() => query.data ?? {}, [query.data]);
  const can = useCallback(
    (module, action = "view") => {
      if (isAdmin) return true;
      const mod = permissions[module];
      if (!mod) return false;
      return Boolean(mod[action]);
    },
    [permissions, isAdmin]
  );
  const hasModule = useCallback(
    (module) => can(module, "view"),
    [can]
  );
  const isActionAllowed = useCallback(
    (module, action) => can(module, action),
    [can]
  );
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.security.myPermissions(token)
    });
  }, [queryClient, token]);
  return {
    permissions,
    can,
    hasModule,
    isActionAllowed,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh
  };
}
function Can({ module, action = "view", children, fallback = null }) {
  const { can, isLoading } = useSecurity();
  if (isLoading) return null;
  return can(module, action) ? /* @__PURE__ */ jsx(Fragment, { children }) : /* @__PURE__ */ jsx(Fragment, { children: fallback });
}
function PermissionButton({
  module,
  action = "update",
  disabled,
  title,
  tooltipWhenDisabled,
  children,
  ...props
}) {
  const { can } = useSecurity();
  const allowed = can(module, action);
  const isButtonDisabled = disabled || !allowed;
  const tooltip = !allowed && tooltipWhenDisabled ? tooltipWhenDisabled : title;
  return /* @__PURE__ */ jsx(
    "button",
    {
      ...props,
      disabled: isButtonDisabled,
      title: tooltip,
      className: `${props.className ?? ""} ${!allowed ? "opacity-50 cursor-not-allowed" : ""}`,
      children
    }
  );
}
export {
  Can,
  PermissionButton,
  useSecurity
};
//# sourceMappingURL=useSecurity.js.map
