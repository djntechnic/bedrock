/**
 * @file ProfilePage.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description The signed-in operator's account: who they are, and a change
 *              password form.
 *
 * `<AppSidebar>`'s user block links to `/profile`, and for a long time the
 * platform shipped the link and the endpoints but no screen behind it — so
 * clicking your own name logged `No routes matched location "/profile"` and
 * rendered nothing. This is that screen; a host routes it at `/profile` and
 * supplies nothing.
 *
 * Identity is read from the auth context rather than re-fetched from
 * `/auth/me`: the context is already populated from that endpoint, and a second
 * request would let the header and this page disagree.
 */
import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { isAxiosError } from "axios";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import PageHeader from "../PageHeader";
import { useAuth } from "../../hooks/useAuth";
import { useChangePassword } from "../../hooks/useProfile";
import UserAccessProfileView from "./UserAccessProfileView";

/** Mirrors `ChangePasswordIn.new_password`'s `min_length`. */
const MIN_PASSWORD_LENGTH = 8;

/** One labelled read-only fact about the account. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const changePassword = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Client-side objections — the mismatch and the length — kept apart from the
  // mutation's error so a typo in the confirm box never reads as a server
  // failure.
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    setLocalError("");

    if (next.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setLocalError("The two new passwords do not match.");
      return;
    }

    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          setDone(true);
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  };

  // 401 is the endpoint's "current password is wrong" and nothing else, so it
  // gets the specific message; anything else is a fault the operator cannot
  // act on and must not be told to re-type their password over.
  const serverError = changePassword.isError
    ? isAxiosError(changePassword.error) &&
      changePassword.error.response?.status === 401
      ? "Current password is incorrect."
      : "Could not change the password. Try again."
    : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Profile" subtitle="Your account and sign-in details." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {user ? (
              <>
                <Field label="Display name" value={user.display_name || "—"} />
                <Field label="Email" value={user.email} />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Roles
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {role}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
                <Field
                  label="Last sign-in"
                  value={
                    user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "—"
                  }
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not signed in.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Change password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {(localError || serverError) && (
                <p role="alert" className="text-sm text-destructive">
                  {localError || serverError}
                </p>
              )}
              {done && !localError && (
                <p role="status" className="text-sm text-positive">
                  Password changed.
                </p>
              )}

              <div>
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? "Saving…" : "Change password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {user?.user_id && (
        <UserAccessProfileView userId={user.user_id} />
      )}
    </div>
  );
}
