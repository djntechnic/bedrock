/**
 * @file KeyboardShortcutsSheet.tsx
 * @module frontend/src/components
 * @description Accessibility-compliant keyboard shortcuts reference panel. Reads
 * its categorized binding matrix and open state from the global
 * {@link useKeyboardShortcuts} manager (config-driven, never hardcoded) and
 * renders inside a Radix Sheet (`side="right"`) which provides focus trapping,
 * ARIA dialog semantics, Escape-to-dismiss, and automatic focus restoration.
 */

import { Fragment } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { useKeyboardShortcuts } from "../context/KeyboardShortcutsContext";

/** Renders a single key chip (e.g. ⌘, K, Esc). */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsSheet() {
  const { isOpen, setOpen, groups, config } = useKeyboardShortcuts();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => setOpen(next, next ? "programmatic" : "escape")}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md gap-0"
        aria-label="Keyboard shortcuts reference"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Keyboard Shortcuts</SheetTitle>
          <SheetDescription>
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[0.7rem]">
              {config.helpKey}
            </kbd>{" "}
            anytime to open this reference.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.bindings.map((binding) => (
                  <li
                    key={binding.id}
                    data-shortcut-id={binding.id}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <span className="text-sm text-foreground">
                      {binding.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {binding.keys.map((chord, ci) => (
                        <Fragment key={ci}>
                          {ci > 0 && (
                            <span className="text-xs text-muted-foreground">
                              /
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            {(Array.isArray(chord) ? chord : [chord]).map(
                              (k, ki) => (
                                <Fragment key={ki}>
                                  {ki > 0 && (
                                    <span className="text-[0.65rem] text-muted-foreground">
                                      +
                                    </span>
                                  )}
                                  <Kbd>{k}</Kbd>
                                </Fragment>
                              )
                            )}
                          </span>
                        </Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
