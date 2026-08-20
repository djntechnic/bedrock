/**
 * @file EditableCell.test.tsx
 * @description The spreadsheet gesture: what opens the editor, what the editor
 *              is seeded with, and what closing it commits.
 *
 * The seeding rules are the point. A double-click keeps the value and selects
 * it; a printable character replaces it; Backspace empties it — and the
 * `openWith` request has to do the same three things for a cell the operator
 * never clicked, because the grid cursor is not DOM focus.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditableCell from "./EditableCell";

const editor = () => screen.queryByLabelText("Edit cell value") as HTMLInputElement | null;
const idle = () => screen.getByLabelText("Double-click or type to edit");

function setup(props: Partial<React.ComponentProps<typeof EditableCell>> = {}) {
  const onCommit = vi.fn();
  const utils = render(
    <EditableCell rawValue="Griffey" onCommit={onCommit} {...props}>
      Griffey
    </EditableCell>,
  );
  return { onCommit, ...utils };
}

describe("opening the editor", () => {
  it("double-click keeps the value and selects it", () => {
    setup();
    fireEvent.doubleClick(idle());
    const input = editor()!;
    expect(input.value).toBe("Griffey");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Griffey".length);
  });

  it("Enter, Space and F2 keep the value", () => {
    for (const key of ["Enter", " ", "F2"]) {
      const { unmount } = setup();
      fireEvent.keyDown(idle(), { key });
      expect(editor()!.value).toBe("Griffey");
      unmount();
    }
  });

  it("a printable character replaces the value and puts the caret after it", () => {
    setup();
    fireEvent.keyDown(idle(), { key: "R" });
    const input = editor()!;
    expect(input.value).toBe("R");
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it("Backspace and Delete open it empty", () => {
    for (const key of ["Backspace", "Delete"]) {
      const { unmount } = setup();
      fireEvent.keyDown(idle(), { key });
      expect(editor()!.value).toBe("");
      unmount();
    }
  });

  it("ignores a modified key and a navigation key", () => {
    setup();
    fireEvent.keyDown(idle(), { key: "c", ctrlKey: true });
    fireEvent.keyDown(idle(), { key: "ArrowDown" });
    expect(editor()).toBeNull();
  });

  it("stays inert when disabled", () => {
    setup({ disabled: true });
    expect(screen.queryByLabelText("Double-click or type to edit")).toBeNull();
    expect(screen.getByText("Griffey")).toBeInTheDocument();
  });
});

describe("openWith", () => {
  it("opens a cell nothing clicked, honouring the seed", () => {
    const { rerender, onCommit } = setup();
    rerender(
      <EditableCell
        rawValue="Griffey"
        onCommit={onCommit}
        openWith={{ seed: "7", nonce: 1 }}
      >
        Griffey
      </EditableCell>,
    );
    expect(editor()!.value).toBe("7");
  });

  it("a null seed keeps the value, as a double-click does", () => {
    const { rerender, onCommit } = setup();
    rerender(
      <EditableCell
        rawValue="Griffey"
        onCommit={onCommit}
        openWith={{ seed: null, nonce: 1 }}
      >
        Griffey
      </EditableCell>,
    );
    expect(editor()!.value).toBe("Griffey");
  });

  it("is edge-triggered — a re-render with the same nonce does not reopen", () => {
    const { rerender, onCommit } = setup();
    const withRequest = (
      <EditableCell
        rawValue="Griffey"
        onCommit={onCommit}
        openWith={{ seed: "7", nonce: 1 }}
      >
        Griffey
      </EditableCell>
    );
    rerender(withRequest);
    fireEvent.keyDown(editor()!, { key: "Escape" });
    expect(editor()).toBeNull();
    // Same request object, same nonce: the operator's Escape stands.
    rerender(withRequest);
    expect(editor()).toBeNull();
    // A bumped nonce is a fresh request and does reopen.
    rerender(
      <EditableCell
        rawValue="Griffey"
        onCommit={onCommit}
        openWith={{ seed: "7", nonce: 2 }}
      >
        Griffey
      </EditableCell>,
    );
    expect(editor()!.value).toBe("7");
  });

  it("reports open and close through onEditingChange", () => {
    const onEditingChange = vi.fn();
    setup({ onEditingChange });
    fireEvent.doubleClick(idle());
    expect(onEditingChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(editor()!, { key: "Escape" });
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });
});

describe("closing the editor", () => {
  it("Enter commits the seeded value", async () => {
    const { onCommit } = setup();
    fireEvent.keyDown(idle(), { key: "R" });
    fireEvent.keyDown(editor()!, { key: "Enter" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("R"));
  });

  it("Escape cancels and restores the original value", () => {
    const { onCommit } = setup();
    fireEvent.keyDown(idle(), { key: "R" });
    fireEvent.keyDown(editor()!, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor()).toBeNull();
    // Reopening shows the untouched value, not the abandoned draft.
    fireEvent.doubleClick(idle());
    expect(editor()!.value).toBe("Griffey");
  });

  it("Backspace-then-Enter commits an empty string", async () => {
    const { onCommit } = setup();
    fireEvent.keyDown(idle(), { key: "Backspace" });
    fireEvent.keyDown(editor()!, { key: "Enter" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(""));
  });

  it("coerces a number column, and rejects text without committing", async () => {
    const { onCommit } = setup({ rawValue: 12, cellType: "number" });
    fireEvent.keyDown(idle(), { key: "9" });
    fireEvent.keyDown(editor()!, { key: "Enter" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(9));

    onCommit.mockClear();
    fireEvent.doubleClick(idle());
    fireEvent.change(editor()!, { target: { value: "abc" } });
    fireEvent.keyDown(editor()!, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not commit an unchanged value", () => {
    const { onCommit } = setup();
    fireEvent.doubleClick(idle());
    fireEvent.keyDown(editor()!, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(editor()).toBeNull();
  });
});
