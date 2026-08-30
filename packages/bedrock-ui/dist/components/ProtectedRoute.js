import { jsx, Fragment } from "react/jsx-runtime";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { useModules } from "../hooks/useModules.js";
import ModuleDisabled from "./ModuleDisabled.js";
function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  allowAnon = false
}) {
  const { user, isAdmin, hasRole, isLoading: authLoading } = useAuth();
  const { hasModule, isLoading: modulesLoading } = useModules();
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
    if (modulesLoading) return null;
    if (!hasModule(requiredModule)) {
      return /* @__PURE__ */ jsx(ModuleDisabled, { reason: "module", required: requiredModule });
    }
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
}
export {
  ProtectedRoute as default
};
//# sourceMappingURL=ProtectedRoute.js.map
