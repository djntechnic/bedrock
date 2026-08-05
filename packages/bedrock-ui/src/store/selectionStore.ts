/**
 * @file selectionStore.ts
 * @module frontend/src/store
 * @description Zustand store for compare-selection state across all grid components.
 * Grids write selected player IDs here; parent pages read from here to render
 * the compare button and navigate to the compare page.
 *
 * Keyed by gridId so multiple grids on the same page don't interfere.
 */

import { create } from "zustand";

interface SelectionStore {
  /** Map from gridId → array of selected player IDs. */
  selectedIdsByGrid: Record<string, number[]>;
  /** Replace the selection for a specific grid. */
  setSelected: (gridId: string, ids: number[]) => void;
  /** Clear the selection for a specific grid. */
  clearSelected: (gridId: string) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedIdsByGrid: {},
  setSelected: (gridId, ids) =>
    set((s) => ({
      selectedIdsByGrid: { ...s.selectedIdsByGrid, [gridId]: ids },
    })),
  clearSelected: (gridId) =>
    set((s) => ({
      selectedIdsByGrid: { ...s.selectedIdsByGrid, [gridId]: [] },
    })),
}));
