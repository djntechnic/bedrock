/**
 * @file EmptyTableRow.tsx
 * @module frontend/src/components
 * @description Shared empty-state table row rendered when a grid has no data matching
 * the current filters. Standardizes the empty state across all 5 grid components.
 */

import { TableRow, TableCell } from "./ui/table";
import { GridStatusContent } from "./GridStatus";

interface EmptyTableRowProps {
  /** Number of columns to span (must match the grid's visible column count). */
  colSpan: number;
  /** Custom message to display. Defaults to a generic "no data" message. */
  message?: string;
}

/**
 * Renders a single full-width table row containing the GridStatusContent "empty" state.
 * Drop this directly inside a <TableBody> in place of a mapped row list.
 */
export function EmptyTableRow({ colSpan, message }: EmptyTableRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <GridStatusContent
          type="empty"
          message={message ?? "No data matches the current filters."}
        />
      </TableCell>
    </TableRow>
  );
}
