/**
 * @file ColumnToggle.tsx
 * @module frontend/src/components
 * @description Shadcn/ui Popover for controlling TanStack Table column visibility.
 */

import { type Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { log } from "../utils/logger";

interface Props<T> {
  /** The TanStack Table instance to control. */
  table: Table<T>;
  /** Grid identifier surfaced on structured column-toggle logs. */
  gridId?: string;
}

/**
 * Renders a button that opens a dropdown list of checkboxes to hide/show table columns.
 * Only columns with 'enableHiding' set to true are displayed.
 */
export default function ColumnToggle<T>({ table, gridId }: Props<T>) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide());

  const visibleCount = toggleableColumns.filter((col) => col.getIsVisible()).length;

  /**
   * Set every toggleable column at once.
   *
   * The reason this exists is the same as the reason the list scrolls: a grid
   * that seeds its bulk-edit columns hidden alongside its browse columns puts
   * twenty-odd entries in here, and reaching one of them was the whole problem.
   * "Show all" then "hide the four I don't want" is far fewer gestures than
   * hunting the four down.
   *
   * @param next - True to show every column, false to hide every one.
   */
  const setAll = (next: boolean) => {
    log.info(
      { gridId, action: "column_toggle_all", visible: next },
      "ColumnToggle: all columns toggled",
    );
    toggleableColumns.forEach((col) => col.toggleVisibility(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label="Toggle column visibility"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      {/* `collisionPadding` keeps Radix from flipping the panel flush against
          the viewport edge, which is what made the last entries unreachable —
          the panel sat past the bottom of the screen with nothing to scroll. */}
      <PopoverContent align="end" collisionPadding={12} className="w-56 p-2">
        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 text-xs text-muted-foreground">
          <span>
            {visibleCount} of {toggleableColumns.length} shown
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
            >
              None
            </button>
          </span>
        </div>
        {/* The scroll region excludes the summary row above, so the count and
            the All/None pair stay reachable however long the list is. The cap
            is the smaller of "most of the viewport" and a fixed height, so a
            short list still sizes to its content. */}
        <div className="max-h-[min(60vh,20rem)] space-y-1 overflow-y-auto">
          {toggleableColumns.map((col) => {
            const meta = col.columnDef.meta as Record<string, any> | undefined;
            const label =
              meta?.label ??
              (typeof col.columnDef.header === "string" ? col.columnDef.header : null) ??
              col.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            return (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={(e) => {
                    log.info(
                      {
                        gridId,
                        action: "column_toggle",
                        columnId: col.id,
                        visible: e.target.checked,
                      },
                      "ColumnToggle: visibility changed",
                    );
                    col.getToggleVisibilityHandler()(e);
                  }}
                  className="rounded"
                />
                {label}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
