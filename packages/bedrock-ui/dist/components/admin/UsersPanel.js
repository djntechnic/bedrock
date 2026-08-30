import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { RefreshCw, Shield, ShieldOff } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Switch } from "../ui/switch.js";
import { useAdminUsers, useAdminSessions, useUpdateAdminUser, useRevokeAdminSession } from "../../hooks/useAdminPlatform.js";
import UserOverridesDrawer from "./UserOverridesDrawer.js";
function shortUserAgent(agent) {
  if (!agent) return "—";
  return agent.length > 48 ? `${agent.slice(0, 48)}…` : agent;
}
function UsersPanel() {
  const users = useAdminUsers();
  const sessions = useAdminSessions();
  const updateUser = useUpdateAdminUser();
  const revoke = useRevokeAdminSession();
  const [selectedUser, setSelectedUser] = useState(null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const userRows = users.data?.data ?? [];
  const sessionRows = (sessions.data?.data ?? []).filter((s) => !s.revoked_at);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", children: [
    /* @__PURE__ */ jsxs("section", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-medium", children: "Accounts" }),
        /* @__PURE__ */ jsxs(
          Button,
          {
            size: "sm",
            variant: "secondary",
            onClick: () => void users.refetch(),
            disabled: users.isFetching,
            children: [
              /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
              "Refresh"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground", children: [
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Email" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Name" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Roles" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Last sign-in" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Active" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-center", children: "Overrides" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: userRows.map((user) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted/10", children: [
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: user.email }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 text-muted-foreground", children: user.display_name || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: user.roles.map((role) => /* @__PURE__ */ jsx(Badge, { variant: "secondary", children: role }, role)) }) }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap", children: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "never" }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: /* @__PURE__ */ jsx(
            Switch,
            {
              checked: user.is_active,
              "aria-label": `${user.email} active`,
              disabled: updateUser.isPending,
              onCheckedChange: (checked) => updateUser.mutate({
                userId: user.user_id,
                payload: { is_active: checked }
              })
            }
          ) }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 text-center", children: /* @__PURE__ */ jsxs(
            Button,
            {
              size: "sm",
              variant: "outline",
              className: "h-7 px-2.5 text-xs gap-1.5 hover:border-primary/50",
              onClick: () => {
                setSelectedUser(user);
                setOverridesOpen(true);
              },
              children: [
                /* @__PURE__ */ jsx(Shield, { className: "h-3 w-3 text-primary" }),
                "Overrides"
              ]
            }
          ) })
        ] }, user.user_id)) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx(
      UserOverridesDrawer,
      {
        user: selectedUser,
        open: overridesOpen,
        onOpenChange: setOverridesOpen
      }
    ),
    /* @__PURE__ */ jsxs("section", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-medium", children: "Active sessions" }),
        /* @__PURE__ */ jsxs(
          Button,
          {
            size: "sm",
            variant: "secondary",
            onClick: () => void sessions.refetch(),
            disabled: sessions.isFetching,
            children: [
              /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
              "Refresh"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground", children: [
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "User" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "IP" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Client" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Started" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Revoke" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: sessionRows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 5, className: "px-3 py-4 text-center text-muted-foreground", children: "No active sessions." }) }) : sessionRows.map((session) => /* @__PURE__ */ jsxs(
          "tr",
          {
            className: "border-b border-border last:border-0",
            children: [
              /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: session.email }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-muted-foreground", children: session.ip_address ?? "—" }),
              /* @__PURE__ */ jsx(
                "td",
                {
                  className: "px-3 py-1.5 text-muted-foreground",
                  title: session.user_agent ?? void 0,
                  children: shortUserAgent(session.user_agent)
                }
              ),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap", children: new Date(session.created_at).toLocaleString() }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 text-right", children: /* @__PURE__ */ jsxs(
                Button,
                {
                  size: "sm",
                  variant: "destructive",
                  disabled: revoke.isPending,
                  onClick: () => revoke.mutate(session.session_id),
                  children: [
                    /* @__PURE__ */ jsx(ShieldOff, { className: "h-3.5 w-3.5" }),
                    "Revoke"
                  ]
                }
              ) })
            ]
          },
          session.session_id
        )) })
      ] }) })
    ] })
  ] });
}
export {
  UsersPanel as default,
  shortUserAgent
};
//# sourceMappingURL=UsersPanel.js.map
