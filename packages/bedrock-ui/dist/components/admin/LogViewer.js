import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select.js";
import EmptyState from "../EmptyState.js";
import { useLogs } from "../../hooks/useAdminPlatform.js";
const ALL = "all";
const SOURCES = [ALL, "activity", "import", "export"];
const LIMITS = [50, 100, 250, 500];
function LogViewer() {
  const [source, setSource] = useState(ALL);
  const [limit, setLimit] = useState(100);
  const logs = useLogs({ source, limit });
  const entries = logs.data?.data ?? [];
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs(Select, { value: source, onValueChange: setSource, children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className: "h-8 w-40 text-xs", "aria-label": "Log source", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
        /* @__PURE__ */ jsx(SelectContent, { children: SOURCES.map((value) => /* @__PURE__ */ jsx(SelectItem, { value, children: value === ALL ? "All sources" : value }, value)) })
      ] }),
      /* @__PURE__ */ jsxs(Select, { value: String(limit), onValueChange: (v) => setLimit(Number(v)), children: [
        /* @__PURE__ */ jsx(SelectTrigger, { className: "h-8 w-32 text-xs", "aria-label": "Row limit", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
        /* @__PURE__ */ jsx(SelectContent, { children: LIMITS.map((value) => /* @__PURE__ */ jsxs(SelectItem, { value: String(value), children: [
          value,
          " rows"
        ] }, value)) })
      ] }),
      /* @__PURE__ */ jsxs(
        Button,
        {
          size: "sm",
          variant: "secondary",
          onClick: () => void logs.refetch(),
          disabled: logs.isFetching,
          children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Refresh"
          ]
        }
      )
    ] }),
    entries.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: ScrollText,
        title: logs.isLoading ? "Loading logs…" : "No log entries",
        description: "Nothing matches the current source and limit."
      }
    ) : /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground", children: [
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Time" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Source" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Event" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Message" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: entries.map((entry, index) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-b border-border last:border-0 align-top",
          children: [
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums whitespace-nowrap text-muted-foreground", children: new Date(entry.timestamp).toLocaleString() }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: /* @__PURE__ */ jsx(Badge, { variant: "secondary", children: entry.source }) }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 font-mono text-xs", children: entry.event_type }),
            /* @__PURE__ */ jsxs("td", { className: "px-3 py-1.5", children: [
              entry.message,
              entry.detail && /* @__PURE__ */ jsx("div", { className: "font-mono text-xs text-muted-foreground whitespace-pre-wrap", children: entry.detail })
            ] })
          ]
        },
        `${entry.timestamp}-${index}`
      )) })
    ] }) })
  ] });
}
export {
  LogViewer as default
};
//# sourceMappingURL=LogViewer.js.map
