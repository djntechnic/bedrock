import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditSession } from "./useEditSession";
import { useEditSessionStore, hasDirtySessions } from "../store/editSessionStore";

vi.mock("../utils/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useEditSession", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("initializes with idle status and clean state", () => {
    const { result } = renderHook(() =>
      useEditSession({ dirty: false, onSave: vi.fn() })
    );

    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
  });

  it("registers in store and sets dirty when dirty is true", () => {
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave: vi.fn() })
    );

    expect(result.current.dirty).toBe(true);
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);
  });

  it("executes save successfully and updates status to saved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(true);
    expect(onSave).toHaveBeenCalled();
  });

  it("vetoes save when onBeforeSave returns false", async () => {
    const onSave = vi.fn();
    const onBeforeSave = vi.fn().mockReturnValue(false);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave, onBeforeSave })
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("stays dirty and reports error when onSave rejects", async () => {
    const error = new Error("Database timeout");
    const onSave = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(error);
    expect(result.current.dirty).toBe(true);
  });

  it("ignores a second save while one is in flight", async () => {
    let resolveSave: () => void = () => {};
    const deferred = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(deferred);

    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let firstPromise: Promise<boolean>;
    let secondPromise: Promise<boolean>;

    act(() => {
      firstPromise = result.current.save();
      secondPromise = result.current.save();
    });

    const secondResult = await secondPromise!;
    expect(secondResult).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await firstPromise;
    });
  });
});
