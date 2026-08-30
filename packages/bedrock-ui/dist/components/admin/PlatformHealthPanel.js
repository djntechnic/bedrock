import { jsxs, jsx } from "react/jsx-runtime";
import { RefreshCw } from "lucide-react";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { useUserSummary, useDbSummary, useApiHealth } from "../../hooks/useAdminPlatform.js";
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
function Tile({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-border p-4", children: [
    /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: label }),
    /* @__PURE__ */ jsx("div", { className: "mt-1 text-2xl font-semibold tabular-nums", children: value })
  ] });
}
function PlatformHealthPanel() {
  const userSummary = useUserSummary();
  const dbSummary = useDbSummary();
  const apiHealth = useApiHealth();
  const users = userSummary.data?.data;
  const db = dbSummary.data?.data;
  const endpoints = [...apiHealth.data?.data ?? []].sort(
    (a, b) => b.hits_24h - a.hits_24h
  );
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [
      /* @__PURE__ */ jsx(Tile, { label: "Users", value: String(users?.total ?? "—") }),
      /* @__PURE__ */ jsx(Tile, { label: "Active", value: String(users?.active ?? "—") }),
      /* @__PURE__ */ jsx(Tile, { label: "Database", value: db ? formatBytes(db.overall_size) : "—" }),
      /* @__PURE__ */ jsx(Tile, { label: "Tables", value: String(db?.tables.length ?? "—") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-medium", children: "API endpoints" }),
      /* @__PURE__ */ jsxs(
        Button,
        {
          size: "sm",
          variant: "secondary",
          onClick: () => void apiHealth.refetch(),
          disabled: apiHealth.isFetching,
          children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Refresh"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground", children: [
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Method" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Path" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Hits 24h" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Hits" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right", children: "Errors" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: "Status" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: endpoints.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 6, className: "px-3 py-4 text-center text-muted-foreground", children: "No endpoint statistics recorded yet." }) }) : endpoints.map((entry) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-b border-border last:border-0",
          children: [
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 font-mono text-xs", children: entry.method }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 font-mono text-xs", children: entry.path }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-right", children: entry.hits_24h }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-right text-muted-foreground", children: entry.hits }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5 tabular-nums text-right", children: entry.errors }),
            /* @__PURE__ */ jsx("td", { className: "px-3 py-1.5", children: /* @__PURE__ */ jsx(
              Badge,
              {
                variant: entry.status === "Error" ? "destructive" : "secondary",
                children: entry.status
              }
            ) })
          ]
        },
        `${entry.method} ${entry.path}`
      )) })
    ] }) })
  ] });
}
export {
  PlatformHealthPanel as default,
  formatBytes
};
//# sourceMappingURL=PlatformHealthPanel.js.map
