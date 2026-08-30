import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select.js";
import EmptyState from "../EmptyState.js";
import { useSecurityEvents } from "../../hooks/useAdminPlatform.js";
const ALL = "all";
const PLATFORM_EVENT_TYPES = [
  "email_verification_request",
  "email_verified",
  "login_failed",
  "login_success",
  "logout",
  "module_access_denied",
  "module_granted",
  "module_revoked",
  "oauth_link",
  "oauth_login",
  "oauth_new_user",
  "password_changed",
  "password_reset_complete",
  "password_reset_request",
  "rate_limit_tripped",
  "register",
  "role_access_denied",
  "role_granted",
  "role_revoked",
  "session_revoked",
  "user_deactivated",
  "user_invited",
  "user_reactivated"
].sort();
function actorLabel(userId, userEmail) {
  return userEmail ?? (userId != null ? `#${userId}` : "—");
}
function SecurityLogViewer({
  eventTypes,
  pageSize = 100
} = {}) {
  const [eventType, setEventType] = useState(ALL);
  const [userIdInput, setUserIdInput] = useState("");
  const [offset, setOffset] = useState(0);
  const options = [ALL, ...PLATFORM_EVENT_TYPES, ...eventTypes ?? []].filter(
    (value, index, all) => all.indexOf(value) === index
  );
  const userId = userIdInput ? Number(userIdInput) : void 0;
  const events = useSecurityEvents({
    event_type: eventType === ALL ? void 0 : eventType,
    user_id: userId,
    limit: pageSize,
    offset
  });
  const rows = events.data?.data?.events ?? [];
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs(
        Select,
        {
          value: eventType,
          onValueChange: (v) => {
            setEventType(v);
            setOffset(0);
          },
          children: [
            /* @__PURE__ */ jsx(SelectTrigger, { className: "h-8 w-56 text-xs", "aria-label": "Event type", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
            /* @__PURE__ */ jsx(SelectContent, { children: options.map((value) => /* @__PURE__ */ jsx(SelectItem, { value, children: value === ALL ? "All events" : value }, value)) })
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        Input,
        {
          className: "h-8 w-32 text-xs",
          "aria-label": "User ID",
          placeholder: "User ID",
          inputMode: "numeric",
          value: userIdInput,
          onChange: (e) => {
            setUserIdInput(e.target.value.replace(/[^0-9]/g, ""));
            setOffset(0);
          }
        }
      ),
      /* @__PURE__ */ jsxs(
        Button,
        {
          size: "sm",
          variant: "secondary",
          onClick: () => void events.refetch(),
          disabled: events.isFetching,
          children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Refresh"
          ]
        }
      )
    ] }),
    events.isError ? /* @__PURE__ */ jsx("p", { className: "text-sm text-destructive", children: "Failed to load security events." }) : rows.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: ShieldAlert,
        title: events.isLoading ? "Loading events…" : "No security events",
        description: "Nothing matches the current event type and user."
      }
    ) : /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground", children: [
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Timestamp" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Event" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Actor" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Target" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "IP" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Detail" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: rows.map((event) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-b border-border last:border-0 align-top",
          children: [
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums whitespace-nowrap text-muted-foreground", children: new Date(event.event_ts).toLocaleString() }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: /* @__PURE__ */ jsx(Badge, { variant: "secondary", children: event.event_type }) }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 font-mono text-xs", children: actorLabel(event.user_id, event.user_email) }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 font-mono text-xs", children: actorLabel(event.target_user_id, event.target_user_email) }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: event.actor_ip ?? "—" }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: event.detail ? /* @__PURE__ */ jsx("code", { className: "text-xs break-all", children: JSON.stringify(event.detail) }) : "—" })
          ]
        },
        event.event_id
      )) })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-2", children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "outline",
          disabled: offset === 0,
          onClick: () => setOffset(Math.max(0, offset - pageSize)),
          children: "Previous"
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "outline",
          disabled: rows.length < pageSize,
          onClick: () => setOffset(offset + pageSize),
          children: "Next"
        }
      )
    ] })
  ] });
}
export {
  PLATFORM_EVENT_TYPES,
  SecurityLogViewer as default
};
//# sourceMappingURL=SecurityLogViewer.js.map
