/**
 * @file ColumnToggle.tsx
 * @module frontend/src/components
 * @description Shadcn/ui Popover for controlling TanStack Table column visibility.
 */
import { type Table } from "@tanstack/react-table";
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
export default function ColumnToggle<T>({ table, gridId }: Props<T>): import("react").JSX.Element;
export {};
