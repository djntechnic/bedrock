/**
 * @file ForgotPasswordPage.tsx
 * @module @djntechnic/bedrock-ui/components/auth
 * @description The "email me a reset link" form (F1).
 *
 * The confirmation is deliberately the same for every address: registered,
 * unregistered, deactivated, and a deployment with no mail backend all get
 * "if an account exists, a link is on its way". The endpoint returns 202 for
 * all four for that reason, and a UI that distinguished them would rebuild the
 * account-enumeration oracle the endpoint gives up a status code to avoid.
 *
 * So: no "no account with that address" state here, ever. That is not an
 * oversight to be helpfully fixed later.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck, Mail } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import AuthFlowCard from "./AuthFlowCard";
import { messageFromError, requestPasswordReset } from "./authFlowApi";

export interface ForgotPasswordPageProps {
  /** Where "back to sign in" goes. */
  loginPath?: string;
}

export default function ForgotPasswordPage({
  loginPath = "/login",
}: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      // Only transport and rate-limit failures land here. A 429 is worth
      // showing verbatim — being told to wait is actionable, unlike anything
      // about the address itself.
      setError(messageFromError(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthFlowCard
        icon={MailCheck}
        tone="success"
        title="Check your email"
        description={
          <>
            If an account exists for <strong>{email}</strong>, a reset link is on
            its way. The link expires shortly, so use it soon.
          </>
        }
      >
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link to={loginPath}>Back to sign in</Link>
          </Button>
        </div>
      </AuthFlowCard>
    );
  }

  return (
    <AuthFlowCard
      icon={Mail}
      title="Reset your password"
      description="Enter your email address and we'll send you a link to set a new password."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email address</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>

        <div className="text-center">
          <Button asChild variant="link" size="sm">
            <Link to={loginPath}>Back to sign in</Link>
          </Button>
        </div>
      </form>
    </AuthFlowCard>
  );
}
