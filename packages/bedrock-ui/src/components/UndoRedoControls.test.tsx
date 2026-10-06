import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UndoRedoControls from "./UndoRedoControls";

describe("UndoRedoControls", () => {
  it("renders buttons with disabled state and triggers callbacks on click", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { rerender } = render(
      <UndoRedoControls canUndo={false} canRedo={false} onUndo={onUndo} onRedo={onRedo} />
    );

    const undoBtn = screen.getByRole("button", { name: /Undo/i });
    const redoBtn = screen.getByRole("button", { name: /Redo/i });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    rerender(
      <UndoRedoControls canUndo={true} canRedo={true} onUndo={onUndo} onRedo={onRedo} />
    );
    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).not.toBeDisabled();

    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalled();
    fireEvent.click(redoBtn);
    expect(onRedo).toHaveBeenCalled();
  });

  it("handles Ctrl+Z and Ctrl+Y shortcuts except when editing an input", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <div>
        <input data-testid="text-field" />
        <UndoRedoControls canUndo={true} canRedo={true} onUndo={onUndo} onRedo={onRedo} />
      </div>
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(onRedo).toHaveBeenCalledTimes(1);

    const input = screen.getByTestId("text-field");
    input.focus();
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
