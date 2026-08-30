import { create } from "zustand";
const useFlyoutStore = create((set, get) => ({
  isOpen: false,
  isPinned: false,
  isExpanded: false,
  activePlayerId: null,
  gridRows: [],
  activeRowIndex: 0,
  openFlyout: (playerId, rowIndex, rows, _modal) => set({ isOpen: true, activePlayerId: playerId, activeRowIndex: rowIndex, gridRows: rows }),
  closeFlyout: () => set((state) => state.isPinned ? state : { isOpen: false, activePlayerId: null }),
  forceClose: () => set({ isOpen: false, activePlayerId: null, isPinned: false }),
  togglePin: () => set((state) => ({ isPinned: !state.isPinned })),
  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  goToPrev: () => {
    const { activeRowIndex, gridRows } = get();
    const nextIndex = Math.max(0, activeRowIndex - 1);
    set({ activeRowIndex: nextIndex, activePlayerId: gridRows[nextIndex]?.player_id ?? null });
  },
  goToNext: () => {
    const { activeRowIndex, gridRows } = get();
    const nextIndex = Math.min(gridRows.length - 1, activeRowIndex + 1);
    set({ activeRowIndex: nextIndex, activePlayerId: gridRows[nextIndex]?.player_id ?? null });
  }
}));
export {
  useFlyoutStore
};
//# sourceMappingURL=flyoutStore.js.map
