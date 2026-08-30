/**
 * @file UsersPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Accounts, live sessions, and granular user capability overrides.
 */
import { Shield, ShieldOff } from "lucide-react";
import { useState } from "react";

import {
  useAdminSessions,
  useAdminUsers,
  useRevokeAdminSession,
  useUpdateAdminUser,
} from "../../hooks/useAdminPlatform";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
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

  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const userRows = users.data?.data ?? [];
  const sessionRows = (sessions.data?.data ?? []).filter((s) => !s.revoked_at);

  return (
    <div className="flex flex-col gap-6" data-testid="users-panel">
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Accounts</h3>

        <div className="rounded-xl border border-border overflow-x-auto bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Roles</th>
                <th className="px-3 py-2 text-left">Last sign-in</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-right">Access Overrides</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((user) => (
                <tr key={user.user_id} className="border-b border-border last:border-0 hover:bg-muted/15 transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground">{user.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {user.display_name || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles || []).map((role: string) => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap text-xs">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "never"}
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5"
                      onClick={() => setSelectedUser(user)}
                    >
                      <Shield className="h-3 w-3 mr-1 text-primary" />
                      Overrides & Profile
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Active sessions</h3>

        <div className="rounded-xl border border-border overflow-x-auto bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
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
                    className="border-b border-border last:border-0 hover:bg-muted/15 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium">{session.email}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground text-xs">
                      {session.ip_address ?? "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-muted-foreground text-xs"
                      title={session.user_agent ?? undefined}
                    >
                      {shortUserAgent(session.user_agent)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(session.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(session.session_id)}
                        className="h-7 text-xs"
                      >
                        <ShieldOff className="h-3 w-3 mr-1" />
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

      {/* User Access Overrides Drawer */}
      {selectedUser && (
        <UserOverridesDrawer
          user={selectedUser}
          open={Boolean(selectedUser)}
          onOpenChange={(open) => !open && setSelectedUser(null)}
        />
      )}
    </div>
  );
}
