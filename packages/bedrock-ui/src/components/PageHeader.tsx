/**
 * @file PageHeader.tsx
 * @module frontend/src/components
 * @description Standard page header with title, description, and action slot.
 */
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
  /**
   * Pin the header — title, subtitle, actions and the rule — to the top of the
   * nearest scroll container, so scrolling a long grid does not scroll away the
   * page's identity and its action buttons.
   *
   * Opt-in rather than the default: `position: sticky` only does anything
   * inside a scroll container, and every host that lays its page out
   * differently would silently reflow if this were switched on for them. A
   * host adopts it one screen at a time.
   *
   * The opaque background and the negative-margin bleed are not decoration —
   * without them the rows scrolling underneath show through the gap between
   * the header's padding and its parent's, which reads as a rendering fault.
   */
  sticky?: boolean;
}

export default function PageHeader({ title, subtitle, actions, badge, meta, breadcrumbs, className, sticky = false }: PageHeaderProps) {
  const hasRight = actions || meta;
  return (
    <div
      className={cn(
        "space-y-2.5",
        sticky &&
          // z-20 clears grid headers (z-10) and stays under popovers and
          // dialogs (z-50), so Columns and a confirm still open over it.
          "sticky top-0 z-20 -mx-4 bg-background px-4 pt-4 pb-2 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
          )}
          {breadcrumbs && (
            <div className="pt-0.5">{breadcrumbs}</div>
          )}
        </div>
        {hasRight && (
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {actions}
          </div>
        )}
      </div>
      <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
    </div>
  );
}
