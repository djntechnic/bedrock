/**
 * @file KeyboardShortcutsContext.tsx
 * @module frontend/src/context
 * @description Global keyboard shortcut manager. Mounts a single window keydown
 * observer that interprets the configured help key, chorded navigation
 * sequences (e.g. "G D"), and the appearance toggle, while cleanly bypassing any
 * keystroke originating inside a text-entry primitive. All state transitions and
 * hotkey activations emit structured Pino telemetry — never bare console output.
 *
 * Every tunable (help key, sequence latency, enable flag) is resolved through
 * the centralized {@link ShortcutsConfig} rather than hardcoded here, satisfying
 * the schema-driven configuration contract.
 */
import { type ReactNode } from "react";
import { type ShortcutCategory } from "../lib/shortcuts";
import type { ShortcutsConfig } from "../types/grid";
/** How a sheet open/close transition was triggered — recorded in telemetry. */
export type ShortcutSource = "hotkey" | "footer_button" | "escape" | "overlay" | "programmatic";
interface KeyboardShortcutsContextValue {
    /** Whether the shortcuts reference sheet is currently open. */
    isOpen: boolean;
    /** Open the sheet, recording the trigger source for telemetry. */
    open: (source?: ShortcutSource) => void;
    /** Close the sheet, recording the trigger source for telemetry. */
    close: (source?: ShortcutSource) => void;
    /** Toggle the sheet, recording the trigger source for telemetry. */
    toggle: (source?: ShortcutSource) => void;
    /** Raw open-state setter passed to Radix `onOpenChange`. */
    setOpen: (next: boolean, source?: ShortcutSource) => void;
    /** Resolved, config-driven shortcut categories for presentation. */
    groups: ShortcutCategory[];
    /** The resolved shortcut configuration (help key, timeouts, flags). */
    config: ShortcutsConfig;
}
/**
 * True when focus rests inside a text-entry primitive where global single-key
 * shortcuts must not fire (native inputs, textareas, selects, contenteditable
 * regions, and ARIA comboboxes). Modifier-based chords are gated separately by
 * their callers.
 */
export declare function isEditableTarget(el: EventTarget | null): boolean;
interface ProviderProps {
    children: ReactNode;
    /** Optional user/DB preference overrides merged onto config defaults. */
    configOverrides?: Partial<ShortcutsConfig> | null;
}
export declare function KeyboardShortcutsProvider({ children, configOverrides, }: ProviderProps): import("react").JSX.Element;
/** Access the global keyboard shortcut manager. */
export declare function useKeyboardShortcuts(): KeyboardShortcutsContextValue;
export {};
