import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useLocation, Navigate } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { useModules } from "../hooks/useModules.js";
import { useSecurity } from "../hooks/useSecurity.js";
import ModuleDisabled from "./ModuleDisabled.js";
import { Button } from "./ui/button.js";
function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  action,
  allowAnon = false
}) {
  const { user, isAdmin, hasRole, isLoading: authLoading } = useAuth();
  const {
    hasModule,
    isLoading: modulesLoading,
    isError: modulesError,
    refetch: refetchModules
  } = useModules();
  const {
    can,
    isLoading: securityLoading,
    isError: securityError,
    refresh: refreshSecurity
  } = useSecurity();
  const location = useLocation();
  if (authLoading) return null;
  if (!user && !allowAnon) {
    return /* @__PURE__ */ jsx(
      Navigate,
      {
        to: "/login",
        replace: true,
        state: { from: location.pathname + location.search }
      }
    );
  }
  if (requiredRole && !isAdmin && !hasRole(requiredRole)) {
    return /* @__PURE__ */ jsx(ModuleDisabled, { reason: "role", required: requiredRole });
  }
  if (requiredModule && !isAdmin) {
    if (modulesError || action && securityError) {
      return /* @__PURE__ */ jsx("div", { className: "min-h-[60vh] flex items-center justify-center p-6", children: /* @__PURE__ */ jsxs("div", { className: "max-w-md text-center space-y-4", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive", children: /* @__PURE__ */ jsx(AlertCircle, { className: "h-7 w-7", "aria-hidden": true }) }),
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: "Unable to verify permissions" }),
        /* @__PURE__ */ jsx("p", { className: "text-muted-foreground text-sm", children: "We encountered a network error while verifying access to this feature. Please check your connection and try again." }),
        /* @__PURE__ */ jsx("div", { className: "pt-2", children: /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "outline",
            className: "gap-2",
            onClick: () => {
              if (modulesError) refetchModules();
              if (action && securityError) refreshSecurity();
            },
            children: [
              /* @__PURE__ */ jsx(RefreshCw, { className: "h-4 w-4" }),
              "Retry"
            ]
          }
        ) })
      ] }) });
    }
    if (modulesLoading) return null;
    if (!hasModule(requiredModule)) {
      return /* @__PURE__ */ jsx(ModuleDisabled, { reason: "module", required: requiredModule });
    }
    if (action) {
      if (securityLoading) return null;
      if (!can(requiredModule, action)) {
        return /* @__PURE__ */ jsx(ModuleDisabled, { reason: "role", required: `${requiredModule}:${action}` });
      }
    }
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
}
export {
  ProtectedRoute as default
};
//# sourceMappingURL=ProtectedRoute.js.map
