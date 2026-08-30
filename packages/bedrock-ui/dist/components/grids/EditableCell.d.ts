/**
 * @file EditableCell.tsx
 * @module frontend/src/components/grids
 * @description Phase 8 H3 inline-editing primitive. Wraps the rendered
 * cell content and, on double-click, swaps it for an inline `<input>`.
 * Phase 10 B1 adds a first-class boolean variant that renders a `<Switch>`
 * inline (no idle/edit split) and commits synchronously on toggle.
 *
 * Contract:
 *   - text/number: Idle renders `children`, double-click (or Enter/Space/F2
 *     when focused) opens an `<Input>` seeded with `rawValue`. Enter/blur
 *     commits, Escape cancels. Typing a printable character opens the editor
 *     seeded with *that character* instead, and Backspace/Delete open it
 *     empty — the spreadsheet gesture, where the first keystroke replaces the
 *     cell rather than being swallowed.
 *   - `openWith` opens a cell the operator never clicked. A grid's cell cursor
 *     is not DOM focus, so a keystroke aimed at the focused cell arrives at a
 *     window listener rather than at this span; `useCellSelection` turns that
 *     into an `openWith` bump. It is an edge-triggered *request* keyed by
 *     `nonce`, not a controlled value — editing state stays internal, so no
 *     existing consumer has to start owning state it never had.
 *   - boolean (Phase 10 B1): renders a `<Switch>` reflecting `rawValue`
 *     (normalized: 1/true → on). Clicking or space/enter toggles state
 *     and calls `onCommit(nextValue ? 1 : 0)` synchronously — no draft
 *     buffer, no cancel gesture. The parent `children` payload is ignored
 *     because the switch IS the display.
 *   - Rejection path (both variants): the primitive surfaces a toast and
 *     leaves the row's optimistic state to the DataGrid host to revert.
 *
 * Disabled when `disabled=true` — the wrapper renders `children` inline
 * with no interaction affordance. DataGrid gates this on
 * `col.editable && !!onCellCommit && !config.readOnly`.
 */
import { type ReactNode } from "react";
export interface EditableCellProps {
    /** The pre-rendered cell payload from the DataGrid pipeline. Shown while idle. */
    children: ReactNode;
    /** Raw scalar value seeded into the editor when activated. */
    rawValue: unknown;
    /** Column cell_type — steers the editor shape (text / number / boolean). */
    cellType?: string | null;
    /** When true, the wrapper is a passive `<span>` around `children`. */
    disabled?: boolean;
    /**
     * Edge-triggered request to open the editor from outside.
     *
     * `nonce` is the trigger: every change to it opens the editor afresh, which
     * is what lets a second keystroke on an already-open cell be distinguished
     * from a re-render. `seed` replaces the value (a printable character, or `""`
     * for Backspace); `null`/absent keeps `rawValue` and selects it, exactly as
     * a double-click does.
     */
    openWith?: {
        seed?: string | null;
        nonce: number;
    } | null;
    /** Fired when the editor opens or closes, so a host can track the open cell. */
    onEditingChange?: (editing: boolean) => void;
    /**
     * Commit hook — receives the raw editor value. Reject with a thrown
     * error (or a Promise rejection) to trigger the revert + toast path.
     */
    onCommit: (nextValue: unknown) => void | Promise<void>;
}
export default function EditableCell({ children, rawValue, cellType, disabled, openWith, onEditingChange, onCommit, }: EditableCellProps): import("react").JSX.Element;
