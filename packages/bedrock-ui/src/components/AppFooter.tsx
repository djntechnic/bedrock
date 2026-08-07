/**
 * @file AppFooter.tsx
 * @module frontend/src/components
 * @description Global application footer with keyboard-shortcut hint and metadata.
 */
import { Keyboard } from "lucide-react";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { useKeyboardShortcuts } from "../context/KeyboardShortcutsContext";
import { useAppSettings } from "../hooks/useAppSettings";

export interface AppFooterProps {
  /**
   * Short line beside the app name. Optional, and rendered only when given —
   * this was the literal string "Baseball Analytics Platform", which every
   * application built on this package would otherwise have shown in its
   * footer.
   */
  tagline?: string;
}

export default function AppFooter({ tagline }: AppFooterProps = {}) {
  const year = new Date().getFullYear();
  const { open } = useKeyboardShortcuts();
  const { system } = useAppSettings();
  return (
    <footer className="app-footer border-t border-border bg-card/80 px-6 py-2.5 shrink-0">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary/60" />
          </div>
          <span className="font-semibold text-foreground/80">{system.appName}</span>
          {tagline ? (
            <>
              <span className="text-border">·</span>
              <span>{tagline}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open keyboard shortcuts guide"
                onClick={() => open("footer_button")}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts</TooltipContent>
          </Tooltip>
          <span className="text-muted-foreground/60">© {year}</span>
        </div>
      </div>
    </footer>
  );
}
