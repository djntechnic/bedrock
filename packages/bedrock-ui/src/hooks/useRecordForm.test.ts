import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecordForm } from "./useRecordForm";
import { useEditSessionStore } from "../store/editSessionStore";

vi.mock("../utils/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useRecordForm", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
    vi.useRealTimers();
  });

  it("tracks field changes, dirty state, and undo/redo stacks", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { name: "Alice", role: "Dev" },
        onSave,
      })
    );

    expect(result.current.session.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.setFieldValue("name", "Bob");
    });

    expect(result.current.values.name).toBe("Bob");
    expect(result.current.session.dirty).toBe(true);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.values.name).toBe("Alice");
    expect(result.current.canRedo).toBe(true);
    expect(result.current.session.dirty).toBe(false);

    act(() => {
      result.current.redo();
    });
    expect(result.current.values.name).toBe("Bob");
  });

  it("re-anchors baseline when initialValues change externally without marking dirty", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialValues }) => useRecordForm({ initialValues, onSave }),
      { initialProps: { initialValues: { name: "Alice" } } }
    );

    rerender({ initialValues: { name: "Charlie" } });
    expect(result.current.values.name).toBe("Charlie");
    expect(result.current.session.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it("flushes history and updates lastSavedAt on successful save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { count: 1 },
        onSave,
      })
    );

    act(() => {
      result.current.setFieldValue("count", 2);
    });
    expect(result.current.canUndo).toBe(true);

    await act(async () => {
      await result.current.session.save();
    });

    expect(onSave).toHaveBeenCalledWith({ count: 2 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it("triggers debounced autosave when configured", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { title: "Draft" },
        onSave,
        autosave: true,
        autosaveDelayMs: 600,
      })
    );

    act(() => {
      result.current.setFieldValue("title", "Updated");
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(onSave).toHaveBeenCalledWith({ title: "Updated" });
  });
});
