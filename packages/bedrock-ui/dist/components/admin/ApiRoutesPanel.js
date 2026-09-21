import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useApiHealth } from "../../hooks/useAdminPlatform.js";
function methodColor(m) {
  switch (m) {
    case "GET":
      return "bg-positive/10 text-positive";
    case "POST":
      return "bg-info/10 text-info";
    case "PATCH":
      return "bg-warning/10 text-warning";
    case "PUT":
      return "bg-secondary text-secondary-foreground";
    case "DELETE":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}
function ApiRoutesPanel({
  routes: propRoutes,
  isLoading: propLoading
}) {
  const apiHealth = useApiHealth();
  const routes = propRoutes ?? apiHealth.data?.data ?? [];
  const isLoading = propLoading ?? apiHealth.isLoading;
  const [filter, setFilter] = useState("");
  const [undocOnly, setUndocOnly] = useState(false);
  if (isLoading) {
    return /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-4", children: "Loading API endpoints..." });
  }
  const filtered = routes.filter((r) => {
    const matchesText = r.path.toLowerCase().includes(filter.toLowerCase()) || r.method.toLowerCase().includes(filter.toLowerCase()) || r.name?.toLowerCase().includes(filter.toLowerCase()) || r.summary?.toLowerCase().includes(filter.toLowerCase());
    const matchesUndoc = !undocOnly || !r.documented;
    return matchesText && matchesUndoc;
  });
  const totalHits = routes.reduce((s, r) => s + (r.hits || 0), 0);
  const totalHits24h = routes.reduce((s, r) => s + (r.hits_24h || 0), 0);
  const totalErrors = routes.reduce((s, r) => s + (r.errors || 0), 0);
  const errorRate = totalHits > 0 ? (totalErrors / totalHits * 100).toFixed(1) : "0.0";
  const undocCount = routes.filter((r) => !r.documented).length;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 sm:grid-cols-5 gap-3", children: [
      { label: "Total Hits", value: totalHits.toLocaleString(), color: "" },
      {
        label: "Hits (24h)",
        value: totalHits24h.toLocaleString(),
        color: ""
      },
      {
        label: "Errors",
        value: totalErrors.toLocaleString(),
        color: "text-destructive"
      },
      {
        label: "Error Rate",
        value: `${errorRate}%`,
        color: "text-warning"
      },
      {
        label: "Undocumented",
        value: String(undocCount),
        color: undocCount > 0 ? "text-warning" : "text-positive"
      }
    ].map(({ label, value, color }) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "p-3 bg-muted/40 rounded border border-border",
        children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase", children: label }),
          /* @__PURE__ */ jsx("p", { className: `text-lg font-bold font-mono ${color}`, children: value })
        ]
      },
      label
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: filter,
          onChange: (e) => setFilter(e.target.value),
          placeholder: "Filter endpoints...",
          className: "rounded border border-input px-3 py-1.5 text-sm bg-background w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        }
      ),
      /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: undocOnly,
            onChange: (e) => setUndocOnly(e.target.checked),
            className: "h-3.5 w-3.5"
          }
        ),
        "Undocumented only"
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground ml-auto", children: [
        filtered.length,
        " of ",
        routes.length,
        " endpoints"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-1", children: filtered.map((r) => /* @__PURE__ */ jsxs(
      "details",
      {
        className: "rounded border border-border group",
        open: r.status === "Error" || !r.documented,
        children: [
          /* @__PURE__ */ jsxs("summary", { className: "flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-muted/30 list-none", children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                className: `px-1.5 py-0.5 rounded text-xs font-bold font-mono shrink-0 ${methodColor(
                  r.method
                )}`,
                children: r.method
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: "font-mono text-xs flex-1 truncate text-foreground",
                title: r.path,
                children: r.path
              }
            ),
            r.summary && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground truncate max-w-[220px] hidden sm:block", children: r.summary }),
            /* @__PURE__ */ jsxs("span", { className: "text-xs tabular-nums text-muted-foreground shrink-0", children: [
              (r.hits || 0).toLocaleString(),
              " hits"
            ] }),
            (r.errors || 0) > 0 && /* @__PURE__ */ jsxs("span", { className: "text-xs text-destructive font-mono shrink-0", children: [
              r.errors,
              " err"
            ] }),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: `px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${r.documented ? "bg-positive/10 text-positive" : "bg-warning/10 text-warning"}`,
                children: r.documented ? "Docs ✓" : "No Docs"
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                className: `px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${r.status === "Healthy" ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"}`,
                children: r.status
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "border-t border-border/50 px-3 py-3 bg-muted/10 space-y-3 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-muted-foreground uppercase mb-1", children: "Description" }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-foreground whitespace-pre-wrap", children: r.description || r.summary || /* @__PURE__ */ jsx("span", { className: "italic text-muted-foreground", children: "No description provided." }) })
            ] }),
            r.parameters && r.parameters.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-muted-foreground uppercase mb-1", children: "Query / Path Parameters" }),
              /* @__PURE__ */ jsxs("table", { className: "w-full text-xs border border-border rounded", children: [
                /* @__PURE__ */ jsx("thead", { className: "bg-muted/50", children: /* @__PURE__ */ jsx("tr", { children: [
                  "Name",
                  "In",
                  "Type",
                  "Required",
                  "Default",
                  "Description"
                ].map((h) => /* @__PURE__ */ jsx(
                  "th",
                  {
                    className: "px-2 py-1 text-left text-muted-foreground font-medium",
                    children: h
                  },
                  h
                )) }) }),
                /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-border/40", children: r.parameters.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono font-medium", children: p.name }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 text-muted-foreground", children: p.in }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono text-info", children: p.type }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1", children: p.required ? /* @__PURE__ */ jsx("span", { className: "text-destructive font-bold", children: "Yes" }) : /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "No" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono text-muted-foreground", children: p.default != null ? String(p.default) : "—" }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 text-muted-foreground", children: p.description || "—" })
                ] }, p.name)) })
              ] })
            ] }),
            r.body_fields && r.body_fields.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold text-muted-foreground uppercase mb-1", children: "Request Body" }),
              /* @__PURE__ */ jsxs("table", { className: "w-full text-xs border border-border rounded", children: [
                /* @__PURE__ */ jsx("thead", { className: "bg-muted/50", children: /* @__PURE__ */ jsx("tr", { children: [
                  "Field",
                  "Type",
                  "Required",
                  "Default",
                  "Description"
                ].map((h) => /* @__PURE__ */ jsx(
                  "th",
                  {
                    className: "px-2 py-1 text-left text-muted-foreground font-medium",
                    children: h
                  },
                  h
                )) }) }),
                /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-border/40", children: r.body_fields.map((f) => /* @__PURE__ */ jsxs("tr", { children: [
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono font-medium", children: f.name }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono text-info", children: f.type }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1", children: f.required ? /* @__PURE__ */ jsx("span", { className: "text-destructive font-bold", children: "Yes" }) : /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "No" }) }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 font-mono text-muted-foreground", children: f.default != null ? String(f.default) : "—" }),
                  /* @__PURE__ */ jsx("td", { className: "px-2 py-1 text-muted-foreground", children: f.description || "—" })
                ] }, f.name)) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-6 text-xs text-muted-foreground", children: [
              r.response_schema && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { className: "font-semibold uppercase", children: "Returns" }),
                /* @__PURE__ */ jsx("span", { className: "ml-2 font-mono text-foreground", children: r.response_schema })
              ] }),
              r.tags && r.tags.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { className: "font-semibold uppercase", children: "Tags" }),
                /* @__PURE__ */ jsx("span", { className: "ml-2", children: r.tags.join(", ") })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { className: "font-semibold uppercase", children: "Last accessed" }),
                /* @__PURE__ */ jsx("span", { className: "ml-2", children: r.last_accessed ? new Date(r.last_accessed).toLocaleString() : "Never" })
              ] })
            ] })
          ] })
        ]
      },
      `${r.method}-${r.path}`
    )) })
  ] });
}
export {
  ApiRoutesPanel as default,
  methodColor
};
//# sourceMappingURL=ApiRoutesPanel.js.map
