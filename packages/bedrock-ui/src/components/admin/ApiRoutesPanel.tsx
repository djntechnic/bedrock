/**
 * @file ApiRoutesPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description API Routes Explorer panel backed by GET /api/v1/admin/api-health.
 *              Surfaces operational telemetry cards, parameter tables, request body schemas,
 *              response types, and documentation status badges with real-time text and undocumented-only filters.
 */

import { useState } from "react";
import {
  useApiHealth,
  type ApiHealthEntry,
} from "../../hooks/useAdminPlatform";

export interface ApiRoutesPanelProps {
  /** Optional pre-fetched routes list. If omitted, fetched via useApiHealth(). */
  routes?: ApiHealthEntry[];
  /** Optional loading state override. */
  isLoading?: boolean;
}

export function methodColor(m: string): string {
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

export default function ApiRoutesPanel({
  routes: propRoutes,
  isLoading: propLoading,
}: ApiRoutesPanelProps) {
  const apiHealth = useApiHealth();
  const routes = propRoutes ?? apiHealth.data?.data ?? [];
  const isLoading = propLoading ?? apiHealth.isLoading;

  const [filter, setFilter] = useState("");
  const [undocOnly, setUndocOnly] = useState(false);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Loading API endpoints...
      </p>
    );
  }

  const filtered = routes.filter((r) => {
    const matchesText =
      r.path.toLowerCase().includes(filter.toLowerCase()) ||
      r.method.toLowerCase().includes(filter.toLowerCase()) ||
      r.name?.toLowerCase().includes(filter.toLowerCase()) ||
      r.summary?.toLowerCase().includes(filter.toLowerCase());
    const matchesUndoc = !undocOnly || !r.documented;
    return matchesText && matchesUndoc;
  });

  const totalHits = routes.reduce((s, r) => s + (r.hits || 0), 0);
  const totalHits24h = routes.reduce((s, r) => s + (r.hits_24h || 0), 0);
  const totalErrors = routes.reduce((s, r) => s + (r.errors || 0), 0);
  const errorRate =
    totalHits > 0 ? ((totalErrors / totalHits) * 100).toFixed(1) : "0.0";
  const undocCount = routes.filter((r) => !r.documented).length;

  return (
    <div className="space-y-4">
      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Hits", value: totalHits.toLocaleString(), color: "" },
          {
            label: "Hits (24h)",
            value: totalHits24h.toLocaleString(),
            color: "",
          },
          {
            label: "Errors",
            value: totalErrors.toLocaleString(),
            color: "text-destructive",
          },
          {
            label: "Error Rate",
            value: `${errorRate}%`,
            color: "text-warning",
          },
          {
            label: "Undocumented",
            value: String(undocCount),
            color: undocCount > 0 ? "text-warning" : "text-positive",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="p-3 bg-muted/40 rounded border border-border"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {label}
            </p>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter and toggle bar */}
      <div className="flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter endpoints..."
          className="rounded border border-input px-3 py-1.5 text-sm bg-background w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={undocOnly}
            onChange={(e) => setUndocOnly(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Undocumented only
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {routes.length} endpoints
        </span>
      </div>

      {/* Collapsible routes accordion */}
      <div className="space-y-1">
        {filtered.map((r) => (
          <details
            key={`${r.method}-${r.path}`}
            className="rounded border border-border group"
            open={r.status === "Error" || !r.documented}
          >
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-muted/30 list-none">
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold font-mono shrink-0 ${methodColor(
                  r.method,
                )}`}
              >
                {r.method}
              </span>
              <span
                className="font-mono text-xs flex-1 truncate text-foreground"
                title={r.path}
              >
                {r.path}
              </span>
              {r.summary && (
                <span className="text-xs text-muted-foreground truncate max-w-[220px] hidden sm:block">
                  {r.summary}
                </span>
              )}
              <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                {(r.hits || 0).toLocaleString()} hits
              </span>
              {(r.errors || 0) > 0 && (
                <span className="text-xs text-destructive font-mono shrink-0">
                  {r.errors} err
                </span>
              )}
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
                  r.documented
                    ? "bg-positive/10 text-positive"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {r.documented ? "Docs ✓" : "No Docs"}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${
                  r.status === "Healthy"
                    ? "bg-positive/10 text-positive"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {r.status}
              </span>
            </summary>

            <div className="border-t border-border/50 px-3 py-3 bg-muted/10 space-y-3 text-sm">
              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Description
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {r.description || r.summary || (
                    <span className="italic text-muted-foreground">
                      No description provided.
                    </span>
                  )}
                </p>
              </div>

              {/* Parameters */}
              {r.parameters && r.parameters.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Query / Path Parameters
                  </p>
                  <table className="w-full text-xs border border-border rounded">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Name",
                          "In",
                          "Type",
                          "Required",
                          "Default",
                          "Description",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-2 py-1 text-left text-muted-foreground font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {r.parameters.map((p) => (
                        <tr key={p.name}>
                          <td className="px-2 py-1 font-mono font-medium">
                            {p.name}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {p.in}
                          </td>
                          <td className="px-2 py-1 font-mono text-info">
                            {p.type}
                          </td>
                          <td className="px-2 py-1">
                            {p.required ? (
                              <span className="text-destructive font-bold">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">
                            {p.default != null ? String(p.default) : "—"}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {p.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Request body */}
              {r.body_fields && r.body_fields.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Request Body
                  </p>
                  <table className="w-full text-xs border border-border rounded">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Field",
                          "Type",
                          "Required",
                          "Default",
                          "Description",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-2 py-1 text-left text-muted-foreground font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {r.body_fields.map((f) => (
                        <tr key={f.name}>
                          <td className="px-2 py-1 font-mono font-medium">
                            {f.name}
                          </td>
                          <td className="px-2 py-1 font-mono text-info">
                            {f.type}
                          </td>
                          <td className="px-2 py-1">
                            {f.required ? (
                              <span className="text-destructive font-bold">
                                Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">
                            {f.default != null ? String(f.default) : "—"}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {f.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Response + metadata */}
              <div className="flex items-start gap-6 text-xs text-muted-foreground">
                {r.response_schema && (
                  <div>
                    <span className="font-semibold uppercase">Returns</span>
                    <span className="ml-2 font-mono text-foreground">
                      {r.response_schema}
                    </span>
                  </div>
                )}
                {r.tags && r.tags.length > 0 && (
                  <div>
                    <span className="font-semibold uppercase">Tags</span>
                    <span className="ml-2">{r.tags.join(", ")}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold uppercase">Last accessed</span>
                  <span className="ml-2">
                    {r.last_accessed
                      ? new Date(r.last_accessed).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
