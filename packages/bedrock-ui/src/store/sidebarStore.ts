/**
 * @file sidebarStore.ts
 * @module frontend/src/store
 * @description Zustand store for the icon-rail sidebar's pin/hover/mobile-open
 *              state. `pinned` is the only piece persisted to localStorage —
 *              hover expansion and the mobile overlay are session-only, mirroring
 *              flyoutStore/cardFlyoutStore's pinned-vs-ephemeral split.
 */
import { create } from "zustand";

const PIN_KEY = "mlbtracker-sidebar-pinned";

function readPinned(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === "true";
  } catch {
    return false;
  }
}

interface SidebarStore {
  /** Persisted: sidebar stays expanded (240px, pushes content) rather than defaulting to the 64px rail. */
  pinned: boolean;
  /** Ephemeral: mouse is over the collapsed rail, so it's showing its hover-expanded overlay. */
  hovered: boolean;
  /** Ephemeral: below the 1024px breakpoint, the off-canvas overlay is open. */
  mobileOpen: boolean;

  togglePinned: () => void;
  setHovered: (hovered: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  pinned: readPinned(),
  hovered: false,
  mobileOpen: false,

  togglePinned: () =>
    set((state) => {
      const next = !state.pinned;
      try {
        localStorage.setItem(PIN_KEY, String(next));
      } catch {
        // localStorage unavailable (private mode) — pin just won't survive reload
      }
      return { pinned: next };
    }),

  setHovered: (hovered) => set({ hovered }),
  setMobileOpen: (open) => set({ mobileOpen: open }),
}));
