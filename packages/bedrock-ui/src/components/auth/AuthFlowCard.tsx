/**
 * @file AuthFlowCard.tsx
 * @module @djntechnic/bedrock-ui/components/auth
 * @description Centred card shell shared by the mail-flow pages (F1).
 *
 * Exists because the three pages are the same page with different copy, and
 * §S1 says repeated UI becomes a component the second time it is written, not
 * the fourth. It is layout only — no state, no data — so a page keeps its own
 * behaviour and only borrows the frame.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface AuthFlowCardProps {
  icon: LucideIcon;
  title: string;
  /** One line under the title. Optional — the success states often say it all in the title. */
  description?: ReactNode;
  children?: ReactNode;
  /**
   * Tints the icon. `destructive` for a dead link, `success` for a completed
   * flow. Both resolve through tokens; §S9 forbids a literal colour here.
   */
  tone?: "default" | "success" | "destructive";
  /** Extra classes on the icon itself — `animate-spin` for a pending state. */
  iconClassName?: string;
}

const TONE_CLASSES: Record<NonNullable<AuthFlowCardProps["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
};

export default function AuthFlowCard({
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
  iconClassName,
}: AuthFlowCardProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-5 p-6">
        <div className="text-center space-y-3">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              TONE_CLASSES[tone],
            )}
          >
            <Icon className={cn("h-7 w-7", iconClassName)} aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
