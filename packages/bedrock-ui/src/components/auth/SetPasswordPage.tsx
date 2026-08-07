/**
 * @file SetPasswordPage.tsx
 * @module @djntechnic/bedrock-ui/components/auth
 * @description Where an invitation or reset link lands (F1). Takes the token
 *              from `?token=`, collects a password, and posts both.
 *
 * One component serves `/accept-invite` and `/reset-password` because the
 * backend serves both from one endpoint: choosing a first password and
 * replacing a forgotten one are the same action by someone who proved control
 * of the address. Only the copy differs, so only the copy is a prop — two
 * components would be two places to fix the next bug in this form.
 *
 * Anonymous. Someone who has forgotten their password cannot be asked to log
 * in first, and an invited user has no password to log in with.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, Link2Off } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import AuthFlowCard from "./AuthFlowCard";
import {
  completePasswordReset,
  messageFromError,
  TOKEN_PARAM,
} from "./authFlowApi";

/** Mirrors the backend's `min_length=8` on `new_password`. */
export const MIN_PASSWORD_LENGTH = 8;

export interface SetPasswordPageProps {
  /**
   * Which copy to show. `invite` for a first password, `reset` for a
   * replacement. The request is byte-for-byte identical either way.
   */
  mode?: "invite" | "reset";
  /** Where "continue to sign in" goes. Apps that do not mount `/login` override it. */
  loginPath?: string;
}

const COPY = {
  invite: {
    title: "Choose your password",
    description: "Set a password to finish setting up your account.",
    submit: "Create account",
    doneTitle: "You're all set",
    doneDescription: "Your account is ready. Sign in to get started.",
  },
  reset: {
    title: "Set a new password",
    description: "Choose a new password for your account.",
    submit: "Update password",
    doneTitle: "Password updated",
    doneDescription:
      "Your password has been changed and every other session has been signed out.",
  },
} as const;

export default function SetPasswordPage({
  mode = "reset",
  loginPath = "/login",
}: SetPasswordPageProps) {
  const [params] = useSearchParams();
  const token = params.get(TOKEN_PARAM) ?? "";
  const copy = COPY[mode];

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // A link with no token at all never reached a mail client intact. Say so
  // before asking for a password we have nowhere to send.
  if (!token) {
    return (
      <AuthFlowCard
        icon={Link2Off}
        tone="destructive"
        title="This link is incomplete"
        description="It may have been cut short by your email client. Open it again from the original message, or request a new one."
      >
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthFlowCard>
    );
  }

  if (done) {
    return (
      <AuthFlowCard
        icon={CheckCircle2}
        tone="success"
        title={copy.doneTitle}
        description={copy.doneDescription}
      >
        <div className="flex justify-center">
          <Button asChild>
            <Link to={loginPath}>Continue to sign in</Link>
          </Button>
        </div>
      </AuthFlowCard>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Checked here as well as by the input's `minLength` because a mismatch
    // and a too-short password both deserve an answer without a round trip —
    // the token is single-use only once *redeemed*, but a wasted 400 still
    // spends a slot against the endpoint's rate limit.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await completePasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(
        messageFromError(err, "Something went wrong. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFlowCard icon={KeyRound} title={copy.title} description={copy.description}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error != null}
          />
          <p className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={error != null}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : copy.submit}
        </Button>
      </form>
    </AuthFlowCard>
  );
}
