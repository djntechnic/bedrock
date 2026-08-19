/**
 * @file GridFocusShell.test.tsx
 * @description The full-viewport grid workspace: slots, and the two ways out.
 *
 * The behaviour worth pinning is dismissal. A stray click on the overlay while a
 * hundred cell edits are unsaved must do nothing, and Escape must be divertable
 * so a consumer can ask before throwing the drafts away.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GridFocusShell from "./GridFocusShell";

describe("GridFocusShell", () => {
  it("renders nothing while closed", () => {
    render(
      <GridFocusShell open={false} onOpenChange={vi.fn()} title="Bulk entry">
        <div>the grid</div>
      </GridFocusShell>,
    );
    expect(screen.queryByText("the grid")).not.toBeInTheDocument();
  });

  it("renders the title, children and both slots when open", () => {
    render(
      <GridFocusShell
        open
        onOpenChange={vi.fn()}
        title="Bulk entry"
        subtitle="40 rows, 3 edited"
        toolbar={<button>Mass update</button>}
        footer={<button>Save</button>}
      >
        <div>the grid</div>
      </GridFocusShell>,
    );
    expect(screen.getByRole("dialog", { name: "Bulk entry" })).toBeInTheDocument();
    expect(screen.getByText("40 rows, 3 edited")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mass update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByText("the grid")).toBeInTheDocument();
  });

  it("still describes itself when no subtitle is given", () => {
    render(
      <GridFocusShell open onOpenChange={vi.fn()} title="Bulk entry">
        <div>the grid</div>
      </GridFocusShell>,
    );
    expect(
      screen.getByText(/Full-screen grid workspace/i),
    ).toBeInTheDocument();
  });

  it("closes through onOpenChange when Escape has no consumer", async () => {
    const onOpenChange = vi.fn();
    render(
      <GridFocusShell open onOpenChange={onOpenChange} title="Bulk entry">
        <div>the grid</div>
      </GridFocusShell>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hands Escape to the consumer instead of closing, when one is supplied", async () => {
    const onOpenChange = vi.fn();
    const onEscape = vi.fn();
    render(
      <GridFocusShell
        open
        onOpenChange={onOpenChange}
        onEscape={onEscape}
        title="Bulk entry"
      >
        <div>the grid</div>
      </GridFocusShell>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
    // The shell stays open; closing it is the consumer's call, once the
    // operator has answered the unsaved-changes prompt.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("the grid")).toBeInTheDocument();
  });

  it("routes the close button through the same veto", async () => {
    const onOpenChange = vi.fn();
    const onEscape = vi.fn();
    render(
      <GridFocusShell
        open
        onOpenChange={onOpenChange}
        onEscape={onEscape}
        title="Bulk entry"
      >
        <div>the grid</div>
      </GridFocusShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Leave focus mode" }));
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on the close button when there is no veto", async () => {
    const onOpenChange = vi.fn();
    render(
      <GridFocusShell open onOpenChange={onOpenChange} title="Bulk entry">
        <div>the grid</div>
      </GridFocusShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Leave focus mode" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignores a click outside the workspace", async () => {
    const onOpenChange = vi.fn();
    render(
      <GridFocusShell open onOpenChange={onOpenChange} title="Bulk entry">
        <div>the grid</div>
      </GridFocusShell>,
    );
    const overlay = document.querySelector("[data-slot='dialog-overlay']");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("the grid")).toBeInTheDocument();
  });
});
