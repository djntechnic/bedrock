/**
 * @file VerifyEmailPage.tsx
 * @module @djntechnic/bedrock-ui/components/auth
 * @description Where a verification link lands (F1). Redeems the token on
 *              mount — there is nothing to ask the user, so asking them to
 *              press a button would be a step that exists only to have a step.
 *
 * Anonymous, like the endpoint it calls: the link is opened from a mail client,
 * which may not be the browser holding the session.
 *
 * It does not refresh the caller's profile, because it cannot assume there is
 * one — this page renders outside `<AuthProvider>` as often as inside it. An
 * already-signed-in user sees `is_verified` update on their next `/auth/me`.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Link2Off, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import AuthFlowCard from "./AuthFlowCard";
import {
  confirmEmailVerification,
  messageFromError,
  TOKEN_PARAM,
} from "./authFlowApi";

type Status = "verifying" | "verified" | "failed";

export interface VerifyEmailPageProps {
  /** Where the button after a successful verification goes. */
  continuePath?: string;
}

export default function VerifyEmailPage({
  continuePath = "/",
}: VerifyEmailPageProps) {
  const [params] = useSearchParams();
  const token = params.get(TOKEN_PARAM) ?? "";

  const [status, setStatus] = useState<Status>(token ? "verifying" : "failed");
  const [error, setError] = useState<string | null>(
    token ? null : "This link is incomplete. Open it again from the original email.",
  );

  // The token is single-use, and React 18 StrictMode mounts every effect twice
  // in development. Without this guard the second call redeems nothing, gets
  // the 400 the backend returns for a spent token, and the page reports a
  // successful verification as a dead link.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    // Deliberately no cleanup flag. The usual `let cancelled = false` pattern
    // is wrong here for the same reason the ref is needed: StrictMode's
    // teardown would cancel the *first* mount's in-flight response, the second
    // mount would skip the request entirely, and the page would sit on
    // "Verifying…" forever. The ref already guarantees one request per token,
    // and a `setState` after unmount is a no-op in React 18.
    confirmEmailVerification(token)
      .then(() => setStatus("verified"))
      .catch((err: unknown) => {
        setError(
          messageFromError(err, "We couldn't verify this address. Please try again."),
        );
        setStatus("failed");
      });
  }, [token]);

  if (status === "verifying") {
    return (
      <AuthFlowCard
        icon={Loader2}
        iconClassName="animate-spin"
        title="Verifying your email…"
        description="This will only take a moment."
      />
    );
  }

  if (status === "verified") {
    return (
      <AuthFlowCard
        icon={CheckCircle2}
        tone="success"
        title="Email verified"
        description="Thanks — your address is confirmed."
      >
        <div className="flex justify-center">
          <Button asChild>
            <Link to={continuePath}>Continue</Link>
          </Button>
        </div>
      </AuthFlowCard>
    );
  }

  return (
    <AuthFlowCard
      icon={Link2Off}
      tone="destructive"
      title="This link didn't work"
      description={error}
    >
      <p className="text-center text-sm text-muted-foreground">
        Verification links expire. Sign in and request a new one from your
        account settings.
      </p>
    </AuthFlowCard>
  );
}
