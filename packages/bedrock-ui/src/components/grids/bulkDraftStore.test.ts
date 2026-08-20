/**
 * @file bulkDraftStore.test.ts
 * @description Cover for the bulk-edit draft reducer.
 *
 * The rules that matter here are the ones a consumer would get wrong if it
 * wrote its own buffer: an edit reverted by hand is not an edit, and a row
 * with nothing pending must not linger as an empty object and hold the Save
 * button on.
 */
import { describe, it, expect } from "vitest";
import { applyDraft, applyDrafts, isDirty, type BulkDrafts } from "./bulkDraftStore";

const write = (rowKey: string, columnId: string, nextValue: unknown, originalValue: unknown) => ({
  rowKey,
  columnId,
  nextValue,
  originalValue,
});

describe("applyDraft", () => {
  it("records a changed cell", () => {
    const next = applyDraft({}, write("SKU1", "price", 12, 10));
    expect(next).toEqual({ SKU1: { price: 12 } });
  });

  it("leaves the previous map untouched", () => {
    // The map is React state; mutating it in place would skip the re-render.
    const prev: BulkDrafts = { SKU1: { price: 12 } };
    applyDraft(prev, write("SKU1", "grade", "PSA 9", null));
    expect(prev).toEqual({ SKU1: { price: 12 } });
  });

  it("clears a cell edited back to its stored value", () => {
    const prev = applyDraft({}, write("SKU1", "price", 12, 10));
    expect(applyDraft(prev, write("SKU1", "price", 10, 10))).toEqual({});
  });

  it("treats an emptied cell and a never-set one as the same absence", () => {
    // A text box cleared to "" arrives as null against a column that was
    // already null. Recording that would hold the dirty flag on forever.
    expect(applyDraft({}, write("SKU1", "grade", null, undefined))).toEqual({});
  });

  it("prunes a row once its last pending cell is reverted", () => {
    let drafts = applyDraft({}, write("SKU1", "price", 12, 10));
    drafts = applyDraft(drafts, write("SKU1", "grade", "PSA 9", null));
    drafts = applyDraft(drafts, write("SKU1", "price", 10, 10));
    expect(drafts).toEqual({ SKU1: { grade: "PSA 9" } });
    drafts = applyDraft(drafts, write("SKU1", "grade", null, null));
    expect(drafts).toEqual({});
    expect(Object.keys(drafts)).toHaveLength(0);
  });

  it("keeps rows independent", () => {
    let drafts = applyDraft({}, write("SKU1", "price", 12, 10));
    drafts = applyDraft(drafts, write("SKU2", "price", 20, 10));
    drafts = applyDraft(drafts, write("SKU1", "price", 10, 10));
    expect(drafts).toEqual({ SKU2: { price: 20 } });
  });

  it("overwrites a cell already pending", () => {
    let drafts = applyDraft({}, write("SKU1", "price", 12, 10));
    drafts = applyDraft(drafts, write("SKU1", "price", 15, 10));
    expect(drafts).toEqual({ SKU1: { price: 15 } });
  });
});

describe("applyDrafts", () => {
  it("applies a batch left to right", () => {
    const drafts = applyDrafts({}, [
      write("SKU1", "price", 12, 10),
      write("SKU2", "price", 12, 10),
      write("SKU3", "price", 12, 10),
    ]);
    expect(Object.keys(drafts)).toEqual(["SKU1", "SKU2", "SKU3"]);
  });

  it("lets a later write in the same batch cancel an earlier one", () => {
    // A paste that lands a column's own values back on it is not an edit,
    // even though every cell in it was written.
    const drafts = applyDrafts({}, [
      write("SKU1", "price", 12, 10),
      write("SKU1", "price", 10, 10),
    ]);
    expect(drafts).toEqual({});
  });

  it("returns the same map for an empty batch", () => {
    const prev: BulkDrafts = { SKU1: { price: 12 } };
    expect(applyDrafts(prev, [])).toBe(prev);
  });
});

describe("isDirty", () => {
  it("is false for an empty store and true once a cell is pending", () => {
    expect(isDirty({})).toBe(false);
    expect(isDirty(applyDraft({}, write("SKU1", "price", 12, 10)))).toBe(true);
  });
});
