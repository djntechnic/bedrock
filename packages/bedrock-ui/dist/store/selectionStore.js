import { create } from "zustand";
const useSelectionStore = create((set) => ({
  selectedIdsByGrid: {},
  setSelected: (gridId, ids) => set((s) => ({
    selectedIdsByGrid: { ...s.selectedIdsByGrid, [gridId]: ids }
  })),
  clearSelected: (gridId) => set((s) => ({
    selectedIdsByGrid: { ...s.selectedIdsByGrid, [gridId]: [] }
  }))
}));
export {
  useSelectionStore
};
//# sourceMappingURL=selectionStore.js.map
