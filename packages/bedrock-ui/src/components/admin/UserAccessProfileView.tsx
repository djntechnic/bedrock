import { useUserOverrides } from "../../hooks/useUserOverrides";
import { Badge } from "../ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

export interface UserAccessProfileViewProps {
  userId: number;
}

function ActionBadge({
  hasAccess,
  overrideState,
}: {
  hasAccess: boolean;
  overrideState: boolean | null;
}) {
  if (overrideState === true) {
    return <Badge variant="default">Force Granted (Override)</Badge>;
  }
  if (overrideState === false) {
    return <Badge variant="destructive">Force Denied (Override)</Badge>;
  }
  return (
    <Badge variant="secondary">
      Role Default {hasAccess ? "(Granted)" : "(Denied)"}
    </Badge>
  );
}

export default function UserAccessProfileView({ userId }: UserAccessProfileViewProps) {
  const { profile, overrides, isLoading } = useUserOverrides(userId);

  if (isLoading) {
    return <div>Loading access profile...</div>;
  }

  if (!profile) {
    return <div>No access profile available.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access & Permissions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold uppercase text-muted-foreground">User Identity</div>
          <div className="text-sm">
            {profile.email || `User #${profile.user_id}`} {profile.is_superuser && "(Superuser)"}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold uppercase text-muted-foreground">Assigned Roles</div>
          <div className="flex flex-wrap gap-2">
            {profile.roles && profile.roles.length > 0 ? (
              profile.roles.map((r) => (
                <Badge key={r} variant="outline">
                  {r}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold uppercase text-muted-foreground">Capability Matrix</div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>View</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead>Delete</TableHead>
                  <TableHead>Execute</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides && overrides.length > 0 ? (
                  overrides.map((mod) => {
                    const caps = profile.capabilities?.[mod.module_slug];
                    return (
                      <TableRow key={mod.module_id}>
                        <TableCell className="font-medium">
                          {mod.module_label} <span className="text-xs text-muted-foreground">({mod.module_slug})</span>
                        </TableCell>
                        <TableCell>
                          <ActionBadge hasAccess={caps?.view ?? false} overrideState={mod.can_view} />
                        </TableCell>
                        <TableCell>
                          <ActionBadge hasAccess={caps?.update ?? false} overrideState={mod.can_update} />
                        </TableCell>
                        <TableCell>
                          <ActionBadge hasAccess={caps?.delete ?? false} overrideState={mod.can_delete} />
                        </TableCell>
                        <TableCell>
                          <ActionBadge hasAccess={caps?.execute ?? false} overrideState={mod.can_execute} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No module overrides data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
