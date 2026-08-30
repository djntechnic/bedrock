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
export declare const useSidebarStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SidebarStore>>;
export {};
