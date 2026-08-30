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
export declare const useCommandPaletteStore: import("zustand").UseBoundStore<import("zustand").StoreApi<CommandPaletteStore>>;
export {};
