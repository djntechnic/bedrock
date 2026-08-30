/**
 * @file flyoutStore.ts
 * @module frontend/src/store
 * @description Zustand store for managing the player profile flyout state and navigation.
 */
interface FlyoutStore {
    isOpen: boolean;
    isPinned: boolean;
    isExpanded: boolean;
    activePlayerId: number | null;
    gridRows: {
        player_id: number;
        full_name: string;
    }[];
    activeRowIndex: number;
    /** Opens the flyout and initializes the navigation snapshot. */
    openFlyout: (playerId: number, rowIndex: number, rows: {
        player_id: number;
        full_name: string;
    }[], _modal?: boolean) => void;
    /** Closes the flyout unless it is pinned (used for backdrop/outside-click). */
    closeFlyout: () => void;
    /** Always closes — ignores pin state. Used by the X button and ESC key. */
    forceClose: () => void;
    togglePin: () => void;
    toggleExpanded: () => void;
    goToPrev: () => void;
    goToNext: () => void;
}
export declare const useFlyoutStore: import("zustand").UseBoundStore<import("zustand").StoreApi<FlyoutStore>>;
export {};
