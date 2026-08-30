/**
 * @file useDraggableColumns.tsx
 * @module frontend/src/hooks
 * @description Controlled drag-and-drop column reordering wrapper component for TanStack grids.
 *
 * This is implemented as a top-level component rather than a hook returning a component
 * to prevent React from recreating the component type on every render (which triggers
 * unmounting/remounting of the children and infinite rendering loops).
 */
import { type ReactNode } from "react";
export interface DndColumnWrapperProps {
    children: ReactNode;
    columnOrder: string[];
    onOrderChange: (next: string[]) => void;
    enabled?: boolean;
}
export declare function DndColumnWrapper({ children, columnOrder, onOrderChange, enabled, }: DndColumnWrapperProps): import("react").JSX.Element;
