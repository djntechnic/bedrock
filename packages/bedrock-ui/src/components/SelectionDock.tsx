import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export interface SelectionDockProps {
  count: number;
  onClear: () => void;
  children?: ReactNode;
  label?: string;
  className?: string;
}

export default function SelectionDock({
  count,
  onClear,
  children,
  label = "Selection",
  className,
}: SelectionDockProps) {
  if (count < 1) return null;

  return (
    <div
      data-testid="selection-dock"
      role="toolbar"
      aria-label={label}
      className={cn(
        "sticky bottom-0 z-10 mt-auto flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-md",
        className
      )}
    >
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
