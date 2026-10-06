import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const COLLAPSE_BELOW = {
  md: "@max-3xl:sr-only",
  lg: "@max-5xl:sr-only",
  xl: "@max-[1350px]:sr-only",
  "2xl": "@max-[1600px]:sr-only",
} as const;

export type CollapseBelow = keyof typeof COLLAPSE_BELOW;

export function collapseClass(below: CollapseBelow): string {
  return COLLAPSE_BELOW[below];
}

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const SQUARE_BELOW = {
  md: "@max-3xl:w-8 @max-3xl:px-0",
  lg: "@max-5xl:w-8 @max-5xl:px-0",
  xl: "@max-[1350px]:w-8 @max-[1350px]:px-0",
  "2xl": "@max-[1600px]:w-8 @max-[1600px]:px-0",
} as const;

export interface AdaptiveButtonProps
  extends Omit<ComponentProps<typeof Button>, "children"> {
  icon: ReactNode;
  label: string;
  collapseBelow?: CollapseBelow;
  square?: boolean;
  hint?: string;
}

export function AdaptiveButton({
  icon,
  label,
  collapseBelow = "lg",
  size = "sm",
  square = false,
  hint,
  className,
  ...props
}: AdaptiveButtonProps) {
  return (
    <Hint label={hint ?? label}>
      <Button
        size={size}
        className={cn(square && ["h-8 shrink-0", SQUARE_BELOW[collapseBelow]], className)}
        {...props}
      >
        {icon}
        <span className={collapseClass(collapseBelow)}>{label}</span>
      </Button>
    </Hint>
  );
}

export interface IconActionProps
  extends Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> {
  icon: ReactNode;
  label: string;
}

export function IconAction({ icon, label, ...props }: IconActionProps) {
  return (
    <Hint label={label}>
      <Button size="icon" variant="ghost" aria-label={label} {...props}>
        {icon}
      </Button>
    </Hint>
  );
}

export const ADAPTIVE_BAR = "@container";
