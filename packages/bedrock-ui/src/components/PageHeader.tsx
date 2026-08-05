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
}

export default function PageHeader({ title, subtitle, actions, badge, meta, breadcrumbs, className }: PageHeaderProps) {
  const hasRight = actions || meta;
  return (
    <div className={cn("space-y-2.5", className)}>
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
