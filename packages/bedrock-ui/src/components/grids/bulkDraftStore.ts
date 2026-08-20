/**
 * @file bulkDraftStore.ts
 * @module frontend/src/components/grids
 * @description The bulk-edit draft map and the rules for writing to it.
 *
 * `<DataGrid>` keeps this map in state and `<EditableCell>` writes one cell at
 * a time, but the gestures that make a bulk grid worth having — fill-down,
 * spreadsheet paste, apply-to-selected — write many cells at once from outside
 * any cell. The reducer lives here, separate from the component, so a consumer
 * driving the store through `draftsOverride` gets the same semantics the
 * engine applies rather than a second implementation that drifts from it.
 */

/** Pending edits, keyed `rowKey → columnId → nextValue`. Empty means clean. */
export type BulkDrafts = Record<string, Record<string, unknown>>;

/** One pending write, as the multi-cell gestures produce them. */
export interface DraftWrite {
  rowKey: string;
  columnId: string;
  nextValue: unknown;
  /**
   * The row's stored value. A write back to it clears the draft rather than
   * recording a no-op, which is what keeps the dirty flag honest when a user
   * edits a cell and then puts it back.
   */
  originalValue: unknown;
}

/** True when `next` should be treated as "no change" against `original`. */
function unchanged(next: unknown, original: unknown): boolean {
  // `null` and `undefined` are the same absence as far as a grid cell is
  // concerned: an emptied text box and a column that never had a value must
  // not read as an edit.
  return next === original || (next == null && original == null);
}

/**
 * Apply one write, returning a new map.
 *
 * :param prev: The current draft map; never mutated.
 * :param write: The cell being written.
 * :returns: The next draft map, with empty rows pruned.
 */
export function applyDraft(prev: BulkDrafts, write: DraftWrite): BulkDrafts {
  const { rowKey, columnId, nextValue, originalValue } = write;
  const rowDrafts = { ...(prev[rowKey] ?? {}) };
  if (unchanged(nextValue, originalValue)) {
    delete rowDrafts[columnId];
  } else {
    rowDrafts[columnId] = nextValue;
  }
  const next = { ...prev };
  // A row with no pending cells is removed rather than left as `{}`, so
  // `isDirty` can stay a key count and a caller can iterate rows safely.
  if (Object.keys(rowDrafts).length === 0) {
    delete next[rowKey];
  } else {
    next[rowKey] = rowDrafts;
  }
  return next;
}

/**
 * Apply a batch of writes in order, returning a new map.
 *
 * One call rather than a fold in the caller, so a paste that reverts half a
 * column produces one state update instead of one per cell.
 *
 * :param prev: The current draft map; never mutated.
 * :param writes: The cells being written, applied left to right.
 * :returns: The next draft map.
 */
export function applyDrafts(prev: BulkDrafts, writes: DraftWrite[]): BulkDrafts {
  return writes.reduce(applyDraft, prev);
}

/** Whether anything is pending. */
export function isDirty(drafts: BulkDrafts): boolean {
  return Object.keys(drafts).length > 0;
}
