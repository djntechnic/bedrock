import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface StepperProps {
  steps: string[];
  current: number;
  className?: string;
}

export default function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol aria-label="Progress" className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((label, index) => {
        const isCurrent = index === current;
        const isComplete = index < current;
        const state = isComplete ? "complete" : isCurrent ? "current" : "upcoming";

        return (
          <li
            key={label}
            data-state={state}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              isCurrent && "border-primary bg-primary/10 text-primary",
              isComplete && "border-border bg-muted/40 text-foreground",
              !isCurrent && !isComplete && "border-border text-muted-foreground bg-transparent"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                isCurrent && "bg-primary text-primary-foreground font-bold",
                isComplete && "bg-muted text-muted-foreground",
                !isCurrent && !isComplete && "text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
