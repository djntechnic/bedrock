/**
 * @file WorkbenchShell.tsx
 * @module @djntechnic/bedrock-ui/components/WorkbenchShell
 * @description The rail-and-detail layout every workbench page composes
 * (spec §4.4): a filterable, searchable, keyboard-driven record rail on the
 * left, a tabbed detail pane on the right, and an inline dirty guard between
 * them. It is layout only — every piece of domain state arrives as a prop and
 * leaves as a callback; the shell owns nothing but which card the keyboard is
 * on and which navigation is waiting behind the guard.
 *
 * The guard is inline, never a modal: a pending navigation parks behind a
 * "Discard unsaved changes?" group in the detail pane until the operator
 * keeps editing or discards.
 */
import { type ReactNode } from "react";
import { type ActionType } from "../../hooks/useSecurity";
export type WorkbenchFilter = "active" | "archived" | "all";
export interface WorkbenchShellProps<T extends {
    id: string | number;
}> {
    /** Page heading. */
    title: string;
    /** Names the rail list and its search box ("Search {railLabel}"). */
    railLabel: string;
    items: T[];
    renderCard: (item: T) => ReactNode;
    selectedId: T["id"] | null;
    onSelect: (id: T["id"]) => void;
    /** With `onFilterChange`, drives the Active | Archived | All control. Omit both to hide it. */
    filter?: WorkbenchFilter;
    onFilterChange?: (filter: WorkbenchFilter) => void;
    /** Replaces the Active | Archived | All control above the search box. */
    railHeader?: ReactNode;
    /** Controlled and debounce-free: every keystroke is reported. */
    search: string;
    onSearchChange: (search: string) => void;
    /** Omit to suppress the "New" button (and its permission lookup). */
    onCreate?: () => void;
    /** Required for the "New" button to render; ignored without `onCreate`. */
    createPermission?: {
        module: string;
        action: ActionType;
    };
    /** When set, create is disabled and this is its tooltip and description. */
    createDisabledReason?: string;
    /** Omit when the detail owns its own tabs; the shell then renders `children` bare. */
    tabs?: {
        value: string;
        label: string;
    }[];
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    /** The detail has unsaved edits; navigation waits behind the guard. */
    dirty: boolean;
    /** Called when the operator discards, before the parked navigation runs. */
    onDiscard?: () => void;
    detailHeader?: ReactNode;
    footer?: ReactNode;
    /** Page-level controls beside the heading, such as a view switcher. */
    headerActions?: ReactNode;
    /** Replaces the rail and detail entirely (a table view) while the header stays. */
    bodyOverride?: ReactNode;
    children?: ReactNode;
}
export default function WorkbenchShell<T extends {
    id: string | number;
}>({ title, railLabel, items, renderCard, selectedId, onSelect, filter, onFilterChange, railHeader, search, onSearchChange, onCreate, createPermission, createDisabledReason, tabs, activeTab, onTabChange, dirty, onDiscard, detailHeader, footer, headerActions, bodyOverride, children, }: WorkbenchShellProps<T>): import("react").JSX.Element;
