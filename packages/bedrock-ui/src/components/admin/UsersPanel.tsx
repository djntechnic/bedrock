/**
 * @file UsersPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Accounts and live sessions.
 *
 * Read-mostly on purpose. Activation and session revocation are here because
 * they are the two things an operator needs *now* when an account is
 * compromised or an ex-contractor still holds a token. Role editing and
 * invitations are not: the platform exports the hooks, but a role picker
 * without the role catalogue in front of it invites typing a slug that grants
 * nothing, and inviting a user belongs to whichever screen owns the mail flow.
 */
import { useState } from "react";
import { RefreshCw, Shield, ShieldOff } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  useAdminSessions,
  useAdminUsers,
  useRevokeAdminSession,
  useUpdateAdminUser,
  type UserRecord,
} from "../../hooks/useAdminPlatform";
import UserOverridesDrawer from "./UserOverridesDrawer";

/** Never render a raw UA string in a table cell; it is 200 characters wide. */
export function shortUserAgent(agent: string | null) {
  if (!agent) return "—";
  return agent.length > 48 ? `${agent.slice(0, 48)}…` : agent;
}

export default function UsersPanel() {
  const users = useAdminUsers();
  const sessions = useAdminSessions();
  const updateUser = useUpdateAdminUser();
  const revoke = useRevokeAdminSession();

  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(false);

  const userRows = users.data?.data ?? [];
  // Revoked sessions stay in the payload as history; the panel is about who is
  // signed in right now, so they are filtered rather than styled.
  const sessionRows = (sessions.data?.data ?? []).filter((s) => !s.revoked_at);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-medium">Accounts</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void users.refetch()}
            disabled={users.isFetching}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Roles</th>
                <th className="px-3 py-2 text-left">Last sign-in</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-center">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((user) => (
                <tr key={user.user_id} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="px-3 py-1.5">{user.email}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {user.display_name || "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "never"}
                  </td>
                  <td className="px-3 py-1.5">
                    <Switch
                      checked={user.is_active}
                      aria-label={`${user.email} active`}
                      disabled={updateUser.isPending}
                      onCheckedChange={(checked) =>
                        updateUser.mutate({
                          userId: user.user_id,
                          payload: { is_active: checked },
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1.5 hover:border-primary/50"
                      onClick={() => {
                        setSelectedUser(user);
                        setOverridesOpen(true);
                      }}
                    >
                      <Shield className="h-3 w-3 text-primary" />
                      Overrides
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <UserOverridesDrawer
        user={selectedUser}
        open={overridesOpen}
        onOpenChange={setOverridesOpen}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-medium">Active sessions</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void sessions.refetch()}
            disabled={sessions.isFetching}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-right">Revoke</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessionRows.map((session) => (
                  <tr
                    key={session.session_id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-1.5">{session.email}</td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                      {session.ip_address ?? "—"}
                    </td>
                    <td
                      className="px-3 py-1.5 text-muted-foreground"
                      title={session.user_agent ?? undefined}
                    >
                      {shortUserAgent(session.user_agent)}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">
                      {new Date(session.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(session.session_id)}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
