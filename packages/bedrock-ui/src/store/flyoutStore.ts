/**
 * @file flyoutStore.ts
 * @module frontend/src/store
 * @description Zustand store for managing the player profile flyout state and navigation.
 */

import { create } from "zustand";

interface FlyoutStore {
  isOpen: boolean;
  isPinned: boolean;
  isExpanded: boolean;
  activePlayerId: number | null;
  gridRows: { player_id: number; full_name: string }[];
  activeRowIndex: number;

  /** Opens the flyout and initializes the navigation snapshot. */
  openFlyout: (playerId: number, rowIndex: number, rows: { player_id: number; full_name: string }[], _modal?: boolean) => void;
  /** Closes the flyout unless it is pinned (used for backdrop/outside-click). */
  closeFlyout: () => void;
  /** Always closes — ignores pin state. Used by the X button and ESC key. */
  forceClose: () => void;
  togglePin: () => void;
  toggleExpanded: () => void;
  goToPrev: () => void;
  goToNext: () => void;
}

export const useFlyoutStore = create<FlyoutStore>((set, get) => ({
  isOpen: false,
  isPinned: false,
  isExpanded: false,
  activePlayerId: null,
  gridRows: [],
  activeRowIndex: 0,

  openFlyout: (playerId, rowIndex, rows, _modal) =>
    set({ isOpen: true, activePlayerId: playerId, activeRowIndex: rowIndex, gridRows: rows }),

  closeFlyout: () =>
    set((state) => (state.isPinned ? state : { isOpen: false, activePlayerId: null })),

  forceClose: () =>
    set({ isOpen: false, activePlayerId: null, isPinned: false }),

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
  },
}));
