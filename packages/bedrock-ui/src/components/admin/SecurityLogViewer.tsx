/**
 * @file SecurityLogViewer.tsx
 * @module frontend/src/components/admin
 * @description The platform security log viewer.
 *
 * `useSecurityEvents` and `/security/events` have been in bedrock since
 * v0.2.1 with no screen, so MLBTracker hand-built one over the same hook —
 * the same gap `<LogViewer>` closed for `useLogs` in #19. This is that
 * viewer's sibling: mount it in an admin route and supply nothing.
 */
import { useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import EmptyState from "../EmptyState";
import { useSecurityEvents } from "../../hooks/useAdminPlatform";

/** `useSecurityEvents` treats `undefined` as "no event-type filter". */
const ALL = "all";

/**
 * A curated subset of `auth_activity_service.EVENT_TYPES` — the entries
 * bedrock's own auth code writes. The rest of that frozenset (config-write
 * and grid-setting audit events, season/alias edits, admin inventory writes)
 * is app-specific and does not belong on the platform's own filter; a
 * consumer that writes those events passes them through the `eventTypes`
 * prop instead.
 *
 * `tests/test_security_event_vocabulary.py` parses this array out of this
 * file and fails if any entry here is not a member of that frozenset — so
 * this list can shrink or reorder freely, but every name in it has to stay
 * real.
 */
export const PLATFORM_EVENT_TYPES: readonly string[] = [
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
  "user_reactivated",
].sort();

export interface SecurityLogViewerProps {
  /** Extra event types to offer in the filter, appended to the platform's own. */
  eventTypes?: readonly string[];
  /** Rows per page. Default 100. */
  pageSize?: number;
}

function actorLabel(userId: number | null, userEmail: string | null): string {
  return userEmail ?? (userId != null ? `#${userId}` : "—");
}

export default function SecurityLogViewer({
  eventTypes,
  pageSize = 100,
}: SecurityLogViewerProps = {}) {
  // Seeded with concrete values rather than `undefined`, matching
  // `<LogViewer>`: a Select handed `undefined` first and a string later
  // flips from uncontrolled to controlled, which React warns about.
  const [eventType, setEventType] = useState<string>(ALL);
  const [userIdInput, setUserIdInput] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const options = [ALL, ...PLATFORM_EVENT_TYPES, ...(eventTypes ?? [])].filter(
    (value, index, all) => all.indexOf(value) === index,
  );

  const userId = userIdInput ? Number(userIdInput) : undefined;

  const events = useSecurityEvents({
    event_type: eventType === ALL ? undefined : eventType,
    user_id: userId,
    limit: pageSize,
    offset,
  });
  const rows = events.data?.data?.events ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={eventType}
          onValueChange={(v) => {
            setEventType(v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="h-8 w-56 text-xs" aria-label="Event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((value) => (
              <SelectItem key={value} value={value}>
                {value === ALL ? "All events" : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          className="h-8 w-32 text-xs"
          aria-label="User ID"
          placeholder="User ID"
          inputMode="numeric"
          value={userIdInput}
          onChange={(e) => {
            setUserIdInput(e.target.value.replace(/[^0-9]/g, ""));
            setOffset(0);
          }}
        />

        <Button
          size="sm"
          variant="secondary"
          onClick={() => void events.refetch()}
          disabled={events.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {events.isError ? (
        <p className="text-sm text-destructive">Failed to load security events.</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={events.isLoading ? "Loading events…" : "No security events"}
          description="Nothing matches the current event type and user."
        />
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Timestamp</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Target</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr
                  key={event.event_id}
                  className="border-b border-border last:border-0 align-top"
                >
                  <td className="px-3 py-1.5 tabular-nums whitespace-nowrap text-muted-foreground">
                    {new Date(event.event_ts).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant="secondary">{event.event_type}</Badge>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {actorLabel(event.user_id, event.user_email)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {actorLabel(event.target_user_id, event.target_user_email)}
                  </td>
                  <td className="px-3 py-1.5">{event.actor_ip ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {event.detail ? (
                      <code className="text-xs break-all">
                        {JSON.stringify(event.detail)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - pageSize))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length < pageSize}
          onClick={() => setOffset(offset + pageSize)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
