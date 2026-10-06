import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditSessionStore, hasDirtySessions } from "./editSessionStore";

describe("editSessionStore", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("registers and unregisters dirty sessions", () => {
    const store = useEditSessionStore.getState();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);

    store.register("session-1", vi.fn());
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);

    useEditSessionStore.getState().unregister("session-1");
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
  });

  it("executes leave action immediately if no dirty session exists", () => {
    const action = vi.fn();
    useEditSessionStore.getState().requestLeave(action);
    expect(action).toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });

  it("parks leave action when a dirty session exists and confirms leave cleanly", () => {
    const discard = vi.fn();
    const action = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    useEditSessionStore.getState().requestLeave(action);
    expect(action).not.toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();

    useEditSessionStore.getState().confirmLeave();
    expect(discard).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });

  it("cancels leave without discarding or navigating", () => {
    const discard = vi.fn();
    const action = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    useEditSessionStore.getState().requestLeave(action);
    useEditSessionStore.getState().cancelLeave();

    expect(discard).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });
});
