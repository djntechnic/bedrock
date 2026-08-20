/**
 * @file LogViewer.tsx
 * @module frontend/src/components/admin
 * @description The platform log viewer.
 *
 * The platform served `/admin/logs` and exported `useLogs` while shipping no
 * screen for it, so every consumer built the same viewer over the same hook.
 * This is that viewer, on the `<GridEditor>` precedent: mount it in an admin
 * route and supply nothing.
 */
import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import EmptyState from "../EmptyState";
import { useLogs } from "../../hooks/useAdminPlatform";

/** `useLogs` treats `"all"` as "no source filter", so the sentinel is its. */
const ALL = "all";

/** The categories the platform writes. A free-text box would only invite typos. */
const SOURCES = [ALL, "activity", "import", "export"] as const;

const LIMITS = [50, 100, 250, 500] as const;

export default function LogViewer() {
  // Seeded with concrete values rather than `undefined`: a Select handed
  // `undefined` first and a string later flips from uncontrolled to
  // controlled, which React warns about.
  const [source, setSource] = useState<string>(ALL);
  const [limit, setLimit] = useState<number>(100);

  const logs = useLogs({ source, limit });
  const entries = logs.data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-8 w-40 text-xs" aria-label="Log source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === ALL ? "All sources" : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="Row limit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMITS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => void logs.refetch()}
          disabled={logs.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={logs.isLoading ? "Loading logs…" : "No log entries"}
          description="Nothing matches the current source and limit."
        />
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  // The payload carries no id, and two events can share a
                  // timestamp to the second, so the index is the only stable
                  // key within one fetched page.
                  key={`${entry.timestamp}-${index}`}
                  className="border-b border-border last:border-0 align-top"
                >
                  <td className="px-3 py-1.5 tabular-nums whitespace-nowrap text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant="secondary">{entry.source}</Badge>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{entry.event_type}</td>
                  <td className="px-3 py-1.5">
                    {entry.message}
                    {entry.detail && (
                      <div className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {entry.detail}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
