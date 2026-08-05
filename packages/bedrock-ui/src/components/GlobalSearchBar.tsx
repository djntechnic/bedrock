/**
 * @file GlobalSearchBar.tsx
 * @module frontend/src/components
 * @description Header trigger that opens the Cmd+K command palette
 *              ({@link CommandPalette}). The actual search/fuzzy-match/results
 *              UI lives in the palette dialog — this is just the always-visible
 *              affordance that opens it.
 */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommandPaletteStore } from "../store/commandPaletteStore";
import { isMacPlatform } from "../lib/shortcuts";

export default function GlobalSearchBar() {
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(isMacPlatform());
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-72 lg:w-80 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 h-8 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left truncate">Search players, teams, pages…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium select-none">
        <span>{isMac ? "⌘" : "Ctrl"}</span>
        <span>K</span>
      </kbd>
    </button>
  );
}
