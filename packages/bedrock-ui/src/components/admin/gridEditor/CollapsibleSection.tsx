/**
 * @file CollapsibleSection.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Reusable Card + Collapsible + persisted-disclosure wrapper. Every
 *              editor panel and sub-card uses this so open/close state is
 *              uniform, keyboard-accessible, and observable in logs.
 *
 *              Accepts an optional `badge` (e.g. an "N changed" dirty indicator)
 *              rendered next to the title so admins can see per-section state
 *              without expanding.
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "../../ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";
import { cn } from "../../../lib/utils";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure";

interface CollapsibleSectionProps {
  /** localStorage key suffix — final key is `mlbtracker.gridEditor.<storageKey>`. */
  storageKey: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional right-side badge (e.g. dirty count, warning). */
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  /** Render the outer `<Card>`. Set false when nested inside another Card. */
  boxed?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  storageKey,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  boxed = true,
  className,
  contentClassName,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = usePersistedDisclosure(storageKey, defaultOpen);

  const inner = (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          !boxed && "px-0",
        )}
        aria-expanded={open}
        data-testid={`collapsible-trigger-${storageKey}`}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        )}
      >
        <div className={cn("px-3 pb-3 space-y-3", !boxed && "px-0", contentClassName)}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  if (!boxed) return <div className={className}>{inner}</div>;

  return <Card className={cn("py-0 overflow-hidden", className)}>{inner}</Card>;
}
