/**
 * @file PageSkeleton.tsx
 * @module frontend/src/components
 * @description Skeleton placeholder shown while a page's data is loading.
 */
import { Skeleton } from "./ui/skeleton";

type Props = {
  rows?: number;
};

export default function PageSkeleton({ rows = 8 }: Props) {
  return (
    <div data-testid="page-skeleton" className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>

      <div className="space-y-2 rounded-md border border-border bg-card/40 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24 ml-auto" />
        </div>
        <div className="h-px w-full bg-border/60" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
