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
      <PopoverContent align="end" className="w-48 p-2">
        <div className="space-y-1">
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
