/**
 * @file EmptyState.tsx
 * @module frontend/src/components
 * @description Reusable empty-state placeholder for grids and lists with no data.
 */
import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center gap-2 px-4", className)}>
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-1">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
