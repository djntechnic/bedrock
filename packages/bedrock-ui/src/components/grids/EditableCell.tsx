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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { seedForKey } from "./useCellSelection";

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
  openWith?: { seed?: string | null; nonce: number } | null;
  /** Fired when the editor opens or closes, so a host can track the open cell. */
  onEditingChange?: (editing: boolean) => void;
  /**
   * Commit hook — receives the raw editor value. Reject with a thrown
   * error (or a Promise rejection) to trigger the revert + toast path.
   */
  onCommit: (nextValue: unknown) => void | Promise<void>;
}

function coerceForCellType(value: string, cellType?: string | null): unknown {
  if (cellType === "number") {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`"${value}" is not a valid number`);
    }
    return parsed;
  }
  return value;
}

export default function EditableCell({
  children,
  rawValue,
  cellType,
  disabled = false,
  openWith = null,
  onEditingChange,
  onCommit,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => stringify(rawValue));
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Set when the editor was opened with replacement text. It survives exactly
   * one mount: the reseed effect below must not overwrite it, and the input
   * must place the caret after it rather than select it.
   */
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (editing) {
      // A seeded open already holds the text the operator typed; reseeding
      // from `rawValue` here would eat that first keystroke. Clearing the flag
      // is this effect's job, not the mount ref's: refs run *before* effects,
      // so a ref that consumed the seed would let this run reseed over it.
      if (seededRef.current === null) setDraft(stringify(rawValue));
      else seededRef.current = null;
    }
    // Focus + select happens once, synchronously, when the input mounts — see
    // the ref callback below. Doing it here via requestAnimationFrame races
    // with typing: the rAF can fire mid-keystroke and re-select the current
    // draft, so the next character replaces the selection instead of
    // appending.
  }, [editing, rawValue]);

  useEffect(() => {
    if (!editing) return;
    onEditingChange?.(true);
    return () => onEditingChange?.(false);
    // `onEditingChange` is deliberately out of the deps: a host that passes an
    // inline arrow would otherwise emit a close/open pair on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const inputMountRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (!node) return;
    node.focus();
    const seed = seededRef.current;
    // Seeded: the character is already the whole value, so the caret goes
    // after it. Unseeded: select, so the next keystroke replaces the old value.
    if (seed === null) node.select();
    else node.setSelectionRange(seed.length, seed.length);
  }, []);

  const activate = useCallback(
    (seed?: string | null) => {
      if (disabled || committing) return;
      if (seed != null) {
        seededRef.current = seed;
        setDraft(seed);
      }
      setEditing(true);
    },
    [disabled, committing],
  );

  // Edge-triggered: only a change of nonce opens the cell, so a host may leave
  // the prop in place across renders without reopening what the operator closed.
  const lastNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!openWith) {
      lastNonceRef.current = null;
      return;
    }
    if (lastNonceRef.current === openWith.nonce) return;
    lastNonceRef.current = openWith.nonce;
    activate(openWith.seed ?? null);
  }, [openWith, activate]);

  const cancel = useCallback(() => {
    seededRef.current = null;
    setEditing(false);
    setDraft(stringify(rawValue));
  }, [rawValue]);

  const commit = useCallback(async () => {
    if (committing) return;
    // Read the input directly rather than the `draft` state closure — React
    // batches state updates inside event handlers, so a fast `type +
    // Enter` sequence can trigger the keydown handler before the last
    // draft change has flushed. The ref always sees the current DOM value.
    const rawInput = inputRef.current?.value ?? draft;
    let coerced: unknown;
    try {
      coerced = coerceForCellType(rawInput, cellType);
    } catch (err) {
      toast.error("Invalid value", {
        description: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    // No-op commits — value unchanged — just close.
    if (coerced === rawValue || stringify(coerced) === stringify(rawValue)) {
      setEditing(false);
      return;
    }
    setCommitting(true);
    try {
      await onCommit(coerced);
      setEditing(false);
    } catch (err) {
      // The DataGrid host is expected to keep the previous value in
      // its row state — the toast is the user-visible signal that the
      // optimistic update was rolled back.
      toast.error("Could not save change", {
        description: err instanceof Error ? err.message : String(err),
      });
      setDraft(stringify(rawValue));
    } finally {
      setCommitting(false);
    }
  }, [committing, draft, cellType, rawValue, onCommit]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel],
  );

  const onIdleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>) => {
      if (disabled) return;
      const seed = seedForKey(e.key, e.ctrlKey || e.metaKey || e.altKey);
      if (seed === undefined) return;
      e.preventDefault();
      activate(seed);
    },
    [activate, disabled],
  );

  if (disabled) {
    return <>{children}</>;
  }

  // Phase 10 B1: boolean cell_type — the switch is always visible and
  // commits synchronously on toggle. No draft state, no double-click
  // affordance; the switch is both display and editor.
  if (cellType === "boolean") {
    const isOn = rawValue === 1 || rawValue === true;
    const onToggle = async (next: boolean) => {
      if (committing) return;
      const nextInt = next ? 1 : 0;
      // Guard against no-op flips (defensive; Switch shouldn't fire this).
      if (nextInt === (isOn ? 1 : 0)) return;
      setCommitting(true);
      try {
        await onCommit(nextInt);
      } catch (err) {
        toast.error("Could not save change", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setCommitting(false);
      }
    };
    return (
      <Switch
        checked={isOn}
        disabled={committing}
        onCheckedChange={(next) => void onToggle(next)}
        aria-label="Toggle value"
      />
    );
  }

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onDoubleClick={() => activate()}
        onKeyDown={onIdleKeyDown}
        aria-label="Double-click or type to edit"
        className={cn(
          "inline-block cursor-text -mx-1 px-1 rounded",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <Input
      ref={inputMountRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={onKeyDown}
      disabled={committing}
      aria-label="Edit cell value"
      inputMode={cellType === "number" ? "decimal" : undefined}
      className="h-6 py-0 px-1 text-xs"
    />
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
