import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  disabled?: boolean;
  className?: string;
}

function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.hasAttribute("contenteditable")
  );
}

export default function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled = false,
  className,
}: UndoRedoControlsProps) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(document.activeElement)) return;
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          onUndo();
        }
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (canRedo) {
          event.preventDefault();
          onRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo, disabled]);

  return (
    <div role="group" aria-label="History" className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
