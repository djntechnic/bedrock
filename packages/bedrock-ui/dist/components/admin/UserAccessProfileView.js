import { jsx, jsxs } from "react/jsx-runtime";
import { useUserOverrides } from "../../hooks/useUserOverrides.js";
import { Badge } from "../ui/badge.js";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../ui/table.js";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card.js";
function ActionBadge({
  hasAccess,
  overrideState
}) {
  if (overrideState === true || overrideState === 1) {
    return /* @__PURE__ */ jsx(Badge, { variant: "default", children: "Force Granted (Override)" });
  }
  if (overrideState === false || overrideState === 0) {
    return /* @__PURE__ */ jsx(Badge, { variant: "destructive", children: "Force Denied (Override)" });
  }
  return /* @__PURE__ */ jsxs(Badge, { variant: "secondary", children: [
    "Role Default ",
    hasAccess ? "(Granted)" : "(Denied)"
  ] });
}
function UserAccessProfileView({ userId }) {
  const { profile, overrides, isLoading } = useUserOverrides(userId);
  if (isLoading) {
    return /* @__PURE__ */ jsx("div", { children: "Loading access profile..." });
  }
  if (!profile) {
    return /* @__PURE__ */ jsx("div", { children: "No access profile available." });
  }
  return /* @__PURE__ */ jsxs(Card, { children: [
    /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsx(CardTitle, { children: "Access & Permissions" }) }),
    /* @__PURE__ */ jsxs(CardContent, { className: "flex flex-col gap-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold uppercase text-muted-foreground", children: "User Identity" }),
        /* @__PURE__ */ jsxs("div", { className: "text-sm", children: [
          profile.email || `User #${profile.user_id}`,
          " ",
          profile.is_superuser && "(Superuser)"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold uppercase text-muted-foreground", children: "Assigned Roles" }),
        /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: profile.roles && profile.roles.length > 0 ? profile.roles.map((r) => /* @__PURE__ */ jsx(Badge, { variant: "outline", children: r }, r)) : /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "None" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold uppercase text-muted-foreground", children: "Capability Matrix" }),
        /* @__PURE__ */ jsx("div", { className: "rounded-md border", children: /* @__PURE__ */ jsxs(Table, { children: [
          /* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsxs(TableRow, { children: [
            /* @__PURE__ */ jsx(TableHead, { children: "Module" }),
            /* @__PURE__ */ jsx(TableHead, { children: "View" }),
            /* @__PURE__ */ jsx(TableHead, { children: "Update" }),
            /* @__PURE__ */ jsx(TableHead, { children: "Delete" }),
            /* @__PURE__ */ jsx(TableHead, { children: "Execute" })
          ] }) }),
          /* @__PURE__ */ jsx(TableBody, { children: overrides && overrides.length > 0 ? overrides.map((mod) => {
            const caps = profile.capabilities?.[mod.module_slug];
            return /* @__PURE__ */ jsxs(TableRow, { children: [
              /* @__PURE__ */ jsxs(TableCell, { className: "font-medium", children: [
                mod.module_label,
                " ",
                /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
                  "(",
                  mod.module_slug,
                  ")"
                ] })
              ] }),
              /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(ActionBadge, { hasAccess: caps?.view ?? false, overrideState: mod.can_view }) }),
              /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(ActionBadge, { hasAccess: caps?.update ?? false, overrideState: mod.can_update }) }),
              /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(ActionBadge, { hasAccess: caps?.delete ?? false, overrideState: mod.can_delete }) }),
              /* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx(ActionBadge, { hasAccess: caps?.execute ?? false, overrideState: mod.can_execute }) })
            ] }, mod.module_id);
          }) : /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan: 5, className: "text-center text-muted-foreground", children: "No module overrides data available." }) }) })
        ] }) })
      ] })
    ] })
  ] });
}
export {
  UserAccessProfileView as default
};
//# sourceMappingURL=UserAccessProfileView.js.map
