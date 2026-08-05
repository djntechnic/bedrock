/**
 * @file useDraggableColumns.tsx
 * @module frontend/src/hooks
 * @description Controlled drag-and-drop column reordering wrapper component for TanStack grids.
 *
 * This is implemented as a top-level component rather than a hook returning a component
 * to prevent React from recreating the component type on every render (which triggers
 * unmounting/remounting of the children and infinite rendering loops).
 */

import { useCallback, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

export interface DndColumnWrapperProps {
  children: ReactNode;
  columnOrder: string[];
  onOrderChange: (next: string[]) => void;
  enabled?: boolean;
}

export function DndColumnWrapper({
  children,
  columnOrder,
  onOrderChange,
  enabled = true,
}: DndColumnWrapperProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!enabled) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      onOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
    },
    [enabled, columnOrder, onOrderChange],
  );

  if (!enabled) return <>{children}</>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
