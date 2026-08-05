/**
 * @file skeleton.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Skeleton loading placeholder primitive.
 */
import { cn } from "../../lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  )
}

export { Skeleton }
