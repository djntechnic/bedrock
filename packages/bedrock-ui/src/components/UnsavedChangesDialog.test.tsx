import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useEditSessionStore } from "../store/editSessionStore";

describe("UnsavedChangesDialog", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("renders AlertDialog when pendingLeave is set and handles Keep editing / Discard", () => {
    const leaveAction = vi.fn();
    const discardSession = vi.fn();
    useEditSessionStore.setState({
      sessions: { s1: discardSession },
      pendingLeave: leaveAction,
    });

    const { rerender } = render(<UnsavedChangesDialog />);

    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Keep editing/i }));
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
    expect(leaveAction).not.toHaveBeenCalled();

    useEditSessionStore.setState({
      sessions: { s1: discardSession },
      pendingLeave: leaveAction,
    });
    rerender(<UnsavedChangesDialog />);

    fireEvent.click(screen.getByRole("button", { name: /Discard/i }));
    expect(discardSession).toHaveBeenCalled();
    expect(leaveAction).toHaveBeenCalled();
  });
});
