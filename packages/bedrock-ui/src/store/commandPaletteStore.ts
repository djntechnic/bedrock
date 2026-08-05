/**
 * @file commandPaletteStore.ts
 * @module frontend/src/store
 * @description Zustand store for the Cmd+K command palette's open state plus
 *              recent/pinned command history, persisted to localStorage so
 *              "recent/pinned items first" survives a reload.
 */
import { create } from "zustand";

const RECENTS_KEY = "mlbtracker-command-recents";
const PINNED_KEY = "mlbtracker-command-pinned";
const MAX_RECENTS = 8;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (private mode) — recents/pins just won't persist
  }
}

interface CommandPaletteStore {
  open: boolean;
  /** Most-recently-executed command ids, newest first, capped at MAX_RECENTS. */
  recentIds: string[];
  /** Explicitly pinned command ids, in pin order. */
  pinnedIds: string[];

  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Records a command execution, moving it to the front of `recentIds`. */
  addRecent: (id: string) => void;
  togglePinned: (id: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  open: false,
  recentIds: readIds(RECENTS_KEY),
  pinnedIds: readIds(PINNED_KEY),

  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),

  addRecent: (id) =>
    set((state) => {
      const next = [id, ...state.recentIds.filter((existing) => existing !== id)].slice(
        0,
        MAX_RECENTS
      );
      writeIds(RECENTS_KEY, next);
      return { recentIds: next };
    }),

  togglePinned: (id) =>
    set((state) => {
      const next = state.pinnedIds.includes(id)
        ? state.pinnedIds.filter((existing) => existing !== id)
        : [...state.pinnedIds, id];
      writeIds(PINNED_KEY, next);
      return { pinnedIds: next };
    }),
}));
