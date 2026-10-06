import { Save, X, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import type { EditSession } from "../hooks/useEditSession";
import UndoRedoControls from "./UndoRedoControls";

export interface SaveBarHistory {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export interface SaveBarProps {
  session: EditSession;
  history?: SaveBarHistory;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export default function SaveBar({
  session,
  history,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: SaveBarProps) {
  const statusText = session.saving
    ? "Saving…"
    : session.status === "error"
      ? "Save failed"
      : session.dirty
        ? "Unsaved changes"
        : session.status === "saved"
          ? "All changes saved"
          : "";

  return (
    <div
      data-testid="save-bar"
      className={cn("flex items-center gap-1.5", className)}
    >
      {statusText && (
        <span
          role="status"
          className={cn(
            "text-xs font-medium mr-1.5",
            session.status === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {statusText}
        </span>
      )}

      {history && (
        <UndoRedoControls
          className="border-r border-border pr-1.5"
          {...history}
          disabled={session.saving}
        />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!session.dirty || session.saving}
        onClick={session.cancel}
        className="gap-1.5"
      >
        <X className="h-4 w-4" />
        <span className="@max-[280px]:sr-only">{cancelLabel}</span>
      </Button>

      <Button
        type="button"
        size="sm"
        disabled={!session.dirty || session.saving}
        onClick={() => {
          void session.save();
        }}
        className="gap-1.5"
      >
        {session.saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="@max-[280px]:sr-only">{saveLabel}</span>
      </Button>
    </div>
  );
}
