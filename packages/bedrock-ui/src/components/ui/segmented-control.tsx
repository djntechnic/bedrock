/**
 * @file segmented-control.tsx
 * @module frontend/src/components/ui
 * @description Segmented-control primitive for mutually exclusive option toggles.
 */
import { cn } from "../../lib/utils";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "sm"
                ? "px-2.5 py-1 text-xs"
                : "px-3 py-1.5 text-sm",
              active
                ? "bg-background text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
