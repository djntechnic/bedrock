/**
 * @file GridStatus.tsx
 * @module frontend/src/components
 * @description Loading/error/empty status surface rendered inside data grids.
 */
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

interface GridStatusProps {
  type: "loading" | "error" | "empty";
  message?: string;
}

export function GridStatusContent({ type, message }: GridStatusProps) {
  if (type === "loading") {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-12 ml-auto" />
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-10" />
          </div>
        ))}
      </div>
    );
  }
  if (type === "error") {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-destructive">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">{message ?? "Something went wrong."}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{message ?? "No results found."}</p>
      <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
    </div>
  );
}

export function GridStatusRow({
  type,
  message,
  colSpan = 1,
}: GridStatusProps & { colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <GridStatusContent type={type} message={message} />
      </td>
    </tr>
  );
}
