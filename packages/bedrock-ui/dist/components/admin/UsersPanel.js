import { jsxs, jsx } from "react/jsx-runtime";
import { Shield, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useAdminUsers, useAdminSessions, useUpdateAdminUser, useRevokeAdminSession } from "../../hooks/useAdminPlatform.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Switch } from "../ui/switch.js";
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
  const userRows = users.data?.data ?? [];
  const sessionRows = (sessions.data?.data ?? []).filter((s) => !s.revoked_at);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", "data-testid": "users-panel", children: [
    /* @__PURE__ */ jsxs("section", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-medium", children: "Accounts" }),
      /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto bg-card shadow-xs", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30", children: [
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Email" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Name" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Roles" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Last sign-in" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Active" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Access Overrides" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: userRows.map((user) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted/15 transition-colors", children: [
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2 font-medium text-foreground", children: user.email }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-muted-foreground", children: user.display_name || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: (user.roles || []).map((role) => /* @__PURE__ */ jsx(Badge, { variant: "secondary", className: "text-xs", children: role }, role)) }) }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap text-xs", children: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "never" }),
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(
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
          /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right", children: /* @__PURE__ */ jsxs(
            Button,
            {
              size: "sm",
              variant: "outline",
              className: "h-7 text-xs px-2.5",
              onClick: () => setSelectedUser(user),
              children: [
                /* @__PURE__ */ jsx(Shield, { className: "h-3 w-3 mr-1 text-primary" }),
                "Overrides & Profile"
              ]
            }
          ) })
        ] }, user.user_id)) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-medium", children: "Active sessions" }),
      /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto bg-card shadow-xs", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30", children: [
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "User" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "IP" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Client" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Started" }),
          /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Revoke" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: sessionRows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 5, className: "px-3 py-4 text-center text-muted-foreground", children: "No active sessions." }) }) : sessionRows.map((session) => /* @__PURE__ */ jsxs(
          "tr",
          {
            className: "border-b border-border last:border-0 hover:bg-muted/15 transition-colors",
            children: [
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 font-medium", children: session.email }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 tabular-nums text-muted-foreground text-xs", children: session.ip_address ?? "—" }),
              /* @__PURE__ */ jsx(
                "td",
                {
                  className: "px-3 py-2 text-muted-foreground text-xs",
                  title: session.user_agent ?? void 0,
                  children: shortUserAgent(session.user_agent)
                }
              ),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap text-xs", children: new Date(session.created_at).toLocaleString() }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right", children: /* @__PURE__ */ jsxs(
                Button,
                {
                  size: "sm",
                  variant: "destructive",
                  disabled: revoke.isPending,
                  onClick: () => revoke.mutate(session.session_id),
                  className: "h-7 text-xs",
                  children: [
                    /* @__PURE__ */ jsx(ShieldOff, { className: "h-3 w-3 mr-1" }),
                    "Revoke"
                  ]
                }
              ) })
            ]
          },
          session.session_id
        )) })
      ] }) })
    ] }),
    selectedUser && /* @__PURE__ */ jsx(
      UserOverridesDrawer,
      {
        user: selectedUser,
        open: Boolean(selectedUser),
        onOpenChange: (open) => !open && setSelectedUser(null)
      }
    )
  ] });
}
export {
  UsersPanel as default,
  shortUserAgent
};
//# sourceMappingURL=UsersPanel.js.map
