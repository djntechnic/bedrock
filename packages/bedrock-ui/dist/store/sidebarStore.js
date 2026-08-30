import { create } from "zustand";
const PIN_KEY = "mlbtracker-sidebar-pinned";
function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === "true";
  } catch {
    return false;
  }
}
const useSidebarStore = create((set) => ({
  pinned: readPinned(),
  hovered: false,
  mobileOpen: false,
  togglePinned: () => set((state) => {
    const next = !state.pinned;
    try {
      localStorage.setItem(PIN_KEY, String(next));
    } catch {
    }
    return { pinned: next };
  }),
  setHovered: (hovered) => set({ hovered }),
  setMobileOpen: (open) => set({ mobileOpen: open })
}));
export {
  useSidebarStore
};
//# sourceMappingURL=sidebarStore.js.map
