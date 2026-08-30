import { jsx, Fragment } from "react/jsx-runtime";
import { useCallback } from "react";
import { useSensors, useSensor, PointerSensor, KeyboardSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
function DndColumnWrapper({
  children,
  columnOrder,
  onOrderChange,
  enabled = true
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const handleDragEnd = useCallback(
    (event) => {
      if (!enabled) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      onOrderChange(arrayMove(columnOrder, oldIndex, newIndex));
    },
    [enabled, columnOrder, onOrderChange]
  );
  if (!enabled) return /* @__PURE__ */ jsx(Fragment, { children });
  return /* @__PURE__ */ jsx(
    DndContext,
    {
      sensors,
      collisionDetection: closestCenter,
      onDragEnd: handleDragEnd,
      children: /* @__PURE__ */ jsx(SortableContext, { items: columnOrder, strategy: horizontalListSortingStrategy, children })
    }
  );
}
export {
  DndColumnWrapper
};
//# sourceMappingURL=useDraggableColumns.js.map
