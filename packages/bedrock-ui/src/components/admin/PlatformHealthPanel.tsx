/**
 * @file PlatformHealthPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Platform-side health: account counts, database size and the
 *              per-endpoint API statistics.
 *
 * Deliberately not an app's own health card. That one answers "can this
 * machine reach its dependencies"; this one answers "what is this deployment
 * doing", and both are worth having open at once when something is wrong.
 */
import { RefreshCw } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  useApiHealth,
  useDbSummary,
  useUserSummary,
} from "../../hooks/useAdminPlatform";

/** Bytes as the operator reads them — the API returns raw bytes. */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function PlatformHealthPanel() {
  const userSummary = useUserSummary();
  const dbSummary = useDbSummary();
  const apiHealth = useApiHealth();

  const users = userSummary.data?.data;
  const db = dbSummary.data?.data;
  // Busiest first: an endpoint list in route order buries the one that matters.
  const endpoints = [...(apiHealth.data?.data ?? [])].sort(
    (a, b) => b.hits_24h - a.hits_24h,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Users" value={String(users?.total ?? "—")} />
        <Tile label="Active" value={String(users?.active ?? "—")} />
        <Tile label="Database" value={db ? formatBytes(db.overall_size) : "—"} />
        <Tile label="Tables" value={String(db?.tables.length ?? "—")} />
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-base font-medium">API endpoints</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void apiHealth.refetch()}
          disabled={apiHealth.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Path</th>
              <th className="px-3 py-2 text-right">Hits 24h</th>
              <th className="px-3 py-2 text-right">Hits</th>
              <th className="px-3 py-2 text-right">Errors</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                  No endpoint statistics recorded yet.
                </td>
              </tr>
            ) : (
              endpoints.map((entry) => (
                <tr
                  key={`${entry.method} ${entry.path}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-1.5 font-mono text-xs">{entry.method}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{entry.path}</td>
                  <td className="px-3 py-1.5 tabular-nums text-right">{entry.hits_24h}</td>
                  <td className="px-3 py-1.5 tabular-nums text-right text-muted-foreground">
                    {entry.hits}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-right">{entry.errors}</td>
                  <td className="px-3 py-1.5">
                    <Badge
                      variant={entry.status === "Error" ? "destructive" : "secondary"}
                    >
                      {entry.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
