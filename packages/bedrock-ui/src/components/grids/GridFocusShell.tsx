/**
 * @file GridFocusShell.tsx
 * @module @djntechnic/bedrock-ui/components/grids
 * @description Full-viewport container for any grid: a sticky toolbar, the grid,
 *              and a sticky footer.
 *
 * The workspace for bulk entry. A grid inside the page shell competes with a
 * header, a breadcrumb and a max-width wrapper, which is fine for reading forty
 * rows and hopeless for typing into them.
 *
 * **Distinct from `admin/gridEditor/GridFocusMode`** on purpose. That one is the
 * Grid Editor's own preview surface and takes a `GridDraft`; this is generic and
 * takes children. They share the size-full `Dialog` override and nothing else,
 * which is a class string rather than a component's worth of behaviour.
 *
 * Dismissal is deliberately hard: outside clicks and outside pointer-downs are
 * prevented, because a stray click landing on the overlay while a hundred
 * unsaved cell edits are open must not close anything. Escape routes through
 * `onEscape` when the consumer supplies one, so a dirty-state confirmation can
 * own the decision.
 */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { log } from "../../utils/logger";

export interface GridFocusShellProps {
  open: boolean;
  /** Called on the close button, and on Escape when `onEscape` is absent. */
  onOpenChange: (open: boolean) => void;
  /** Names the workspace. Also the accessible dialog title. */
  title: string;
  /** Optional second line under the title — the row count, the mode, a warning. */
  subtitle?: ReactNode;
  /** Sticky at the top, beside the title. */
  toolbar?: ReactNode;
  /** Sticky at the bottom. Where a Save/Discard bar goes. */
  footer?: ReactNode;
  /** The grid. Scrolls; the toolbar and footer do not. */
  children: ReactNode;
  /**
   * Escape veto. Supply this and Escape calls it *instead* of closing, which is
   * what makes an unsaved-changes confirmation possible — the consumer closes
   * the shell itself once the operator has answered.
   */
  onEscape?: () => void;
  /** For the log line, so a focus session is attributable to a grid. */
  gridId?: string;
  /** Extra classes on the scrolling content region. */
  contentClassName?: string;
}

/**
 * @param props - See {@link GridFocusShellProps}.
 * @returns The focus-mode workspace, or nothing while closed.
 */
export default function GridFocusShell({
  open,
  onOpenChange,
  title,
  subtitle,
  toolbar,
  footer,
  children,
  onEscape,
  gridId,
  contentClassName,
}: GridFocusShellProps) {
  const handleOpenChange = (next: boolean) => {
    log.info(
      { gridId, action: next ? "focus.enter" : "focus.exit" },
      `GridFocusShell: ${next ? "entered" : "left"} focus mode`,
    );
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr_auto] gap-0 rounded-none bg-background p-0 text-foreground sm:max-w-none"
        aria-describedby="grid-focus-shell-desc"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (!onEscape) return;
          event.preventDefault();
          log.info(
            { gridId, action: "focus.escape" },
            "GridFocusShell: Escape handed to the consumer",
          );
          onEscape();
        }}
      >
        <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
          <div className="min-w-0">
            <DialogTitle className="truncate">{title}</DialogTitle>
            {subtitle ? (
              <DialogDescription
                id="grid-focus-shell-desc"
                className="truncate text-xs"
              >
                {subtitle}
              </DialogDescription>
            ) : (
              <DialogDescription id="grid-focus-shell-desc" className="sr-only">
                Full-screen grid workspace. Press Escape to leave.
              </DialogDescription>
            )}
          </div>
          {toolbar ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {toolbar}
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label="Leave focus mode"
            onClick={() => (onEscape ? onEscape() : handleOpenChange(false))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={cn("min-h-0 overflow-auto p-3", contentClassName)}>
          {children}
        </div>

        {footer ? (
          <div className="border-t bg-card px-4 py-2">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
