/**
 * @file KeyboardShortcutsSheet.tsx
 * @module frontend/src/components
 * @description Accessibility-compliant keyboard shortcuts reference panel. Reads
 * its categorized binding matrix and open state from the global
 * {@link useKeyboardShortcuts} manager (config-driven, never hardcoded) and
 * renders inside a Radix Sheet (`side="right"`) which provides focus trapping,
 * ARIA dialog semantics, Escape-to-dismiss, and automatic focus restoration.
 */
export default function KeyboardShortcutsSheet(): import("react").JSX.Element;
