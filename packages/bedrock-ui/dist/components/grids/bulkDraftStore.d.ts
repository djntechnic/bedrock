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
/**
 * Apply one write, returning a new map.
 *
 * :param prev: The current draft map; never mutated.
 * :param write: The cell being written.
 * :returns: The next draft map, with empty rows pruned.
 */
export declare function applyDraft(prev: BulkDrafts, write: DraftWrite): BulkDrafts;
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
export declare function applyDrafts(prev: BulkDrafts, writes: DraftWrite[]): BulkDrafts;
/** Whether anything is pending. */
export declare function isDirty(drafts: BulkDrafts): boolean;
