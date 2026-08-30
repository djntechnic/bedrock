import { create } from "zustand";
const RECENTS_KEY = "mlbtracker-command-recents";
const PINNED_KEY = "mlbtracker-command-pinned";
const MAX_RECENTS = 8;
function readIds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function writeIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
  }
}
const useCommandPaletteStore = create((set) => ({
  open: false,
  recentIds: readIds(RECENTS_KEY),
  pinnedIds: readIds(PINNED_KEY),
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  addRecent: (id) => set((state) => {
    const next = [id, ...state.recentIds.filter((existing) => existing !== id)].slice(
      0,
      MAX_RECENTS
    );
    writeIds(RECENTS_KEY, next);
    return { recentIds: next };
  }),
  togglePinned: (id) => set((state) => {
    const next = state.pinnedIds.includes(id) ? state.pinnedIds.filter((existing) => existing !== id) : [...state.pinnedIds, id];
    writeIds(PINNED_KEY, next);
    return { pinnedIds: next };
  })
}));
export {
  useCommandPaletteStore
};
//# sourceMappingURL=commandPaletteStore.js.map
