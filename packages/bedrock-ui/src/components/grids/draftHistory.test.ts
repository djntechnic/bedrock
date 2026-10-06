import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  draftHistoryReducer,
  useDraftHistory,
  type DraftHistoryAction,
} from "./draftHistory";

describe("draftHistory", () => {
  it("does not spend an undo slot on a write that changes nothing per Review Focus 5", () => {
    const initial = {
      drafts: { row1: { col1: "alpha" } },
      past: [],
      future: [],
    };

    const action: DraftHistoryAction = {
      type: "write",
      writes: [{ rowKey: "row1", columnId: "col1", nextValue: "alpha", originalValue: "orig" }],
    };

    const next = draftHistoryReducer(initial, action);
    expect(next.drafts).toEqual(initial.drafts);
    expect(next.past).toHaveLength(0);
  });

  it("pushes previous drafts to past and clears future on valid write", () => {
    const initial = {
      drafts: { row1: { col1: "alpha" } },
      past: [],
      future: [{ row1: { col1: "future" } }],
    };

    const action: DraftHistoryAction = {
      type: "write",
      writes: [{ rowKey: "row1", columnId: "col1", nextValue: "beta", originalValue: "orig" }],
    };

    const next = draftHistoryReducer(initial, action);
    expect(next.drafts.row1.col1).toBe("beta");
    expect(next.past).toHaveLength(1);
    expect(next.past[0].row1.col1).toBe("alpha");
    expect(next.future).toHaveLength(0);
  });

  it("caps undo history at 50 entries", () => {
    const state = {
      drafts: {},
      past: Array.from({ length: 50 }, (_, i) => ({ r: { c: `${i}` } })),
      future: [],
    };

    const next = draftHistoryReducer(state, {
      type: "write",
      writes: [{ rowKey: "r", columnId: "c", nextValue: "51", originalValue: "orig" }],
    });

    expect(next.past).toHaveLength(50);
  });

  it("handles undo and redo correctly via useDraftHistory hook", () => {
    const { result } = renderHook(() => useDraftHistory());

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.write([{ rowKey: "1", columnId: "name", nextValue: "Item A", originalValue: "" }]);
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.drafts["1"]?.name).toBe("Item A");

    act(() => {
      result.current.undo();
    });
    expect(result.current.drafts["1"]?.name).toBeUndefined();
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.drafts["1"]?.name).toBe("Item A");
  });
});
