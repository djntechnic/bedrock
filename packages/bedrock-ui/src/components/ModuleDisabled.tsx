/**
 * @file ModuleDisabled.tsx
 * @module frontend/src/components
 * @description Phase 5.9 — shared page rendered when a route is blocked by
 *              a missing role or module grant. Styled empty-state with a
 *              "contact your admin" CTA; explicitly does NOT redirect so the
 *              user keeps their URL and can see why access failed.
 */
import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";

interface Props {
  reason: "role" | "module";
  required: string;
}

export default function ModuleDisabled({ reason, required }: Props) {
  const headline =
    reason === "role"
      ? "Role required"
      : "Feature not enabled for your account";
  const detail =
    reason === "role"
      ? `Access to this page requires the "${required}" role.`
      : `The "${required}" module is not enabled for your account. Your administrator can grant it in the admin console.`;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-4 p-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShieldOff className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold">{headline}</h1>
        <p className="text-muted-foreground">{detail}</p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild variant="outline">
            <Link to="/">Return to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
