/**
 * @file WorkbenchShell.session.test.tsx
 * @module @djntechnic/bedrock-ui/components/WorkbenchShell
 * @description WorkbenchShell's EditSession integration: the leave guard offers
 * "Save and continue", only navigates when the save succeeds, and a discard
 * cancels the session. Also pins the rail card geometry and neutral hover.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EditSession } from "../../hooks/useEditSession";
import { TooltipProvider } from "../ui/tooltip";
import WorkbenchShell from "./WorkbenchShell";

function createMockSession(overrides: Partial<EditSession> = {}): EditSession {
  return {
    dirty: false,
    saving: false,
    status: "idle",
    error: null,
    save: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
    guard: vi.fn(),
    ...overrides,
  };
}

type Item = { id: string; title: string };

const ITEMS: Item[] = [
  { id: "1", title: "Item 1" },
  { id: "2", title: "Item 2" },
];

function renderShell(options: { session?: EditSession; onSelect?: (id: string) => void } = {}) {
  const ui: ReactNode = (
    <WorkbenchShell<Item>
      title="Test Bench"
      railLabel="Items"
      items={ITEMS}
      selectedId="1"
      onSelect={options.onSelect ?? vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      dirty={false}
      session={options.session}
      renderCard={(item) => <div>{item.title}</div>}
    >
      <div>Body</div>
    </WorkbenchShell>
  );
  return render(ui, { wrapper: TooltipProvider });
}

describe("WorkbenchShell with EditSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders rounder cards and neutral hover classes", () => {
    renderShell();
    const option = screen.getByRole("option", { name: /Item 2/i });
    expect(option.className).toContain("rounded-lg");
    expect(option.className).toContain("hover:bg-muted");
    expect(option.className).not.toContain("hover:bg-accent/50");
  });

  it("takes its dirty state from the session when one is supplied", () => {
    renderShell({ session: createMockSession({ dirty: true }) });
    fireEvent.click(screen.getByRole("option", { name: /Item 2/i }));
    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();
  });

  it("offers no Save and continue without a session", () => {
    render(
      <WorkbenchShell<Item>
        title="Test Bench"
        railLabel="Items"
        items={ITEMS}
        selectedId="1"
        onSelect={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        dirty
        renderCard={(item) => <div>{item.title}</div>}
      >
        <div>Body</div>
      </WorkbenchShell>,
      { wrapper: TooltipProvider },
    );
    fireEvent.click(screen.getByRole("option", { name: /Item 2/i }));
    expect(screen.queryByRole("button", { name: /Save and continue/i })).toBeNull();
  });

  it("saves then navigates from Save and continue", async () => {
    const session = createMockSession({ dirty: true });
    const onSelect = vi.fn();
    renderShell({ session, onSelect });

    fireEvent.click(screen.getByRole("option", { name: /Item 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));

    await waitFor(() => {
      expect(session.save).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith("2");
    });
  });

  it("does not navigate when save fails", async () => {
    const session = createMockSession({ dirty: true, save: vi.fn().mockResolvedValue(false) });
    const onSelect = vi.fn();
    renderShell({ session, onSelect });

    fireEvent.click(screen.getByRole("option", { name: /Item 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));

    await waitFor(() => expect(session.save).toHaveBeenCalled());
    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls session.cancel on Discard and then navigates", () => {
    const session = createMockSession({ dirty: true });
    const onSelect = vi.fn();
    renderShell({ session, onSelect });

    fireEvent.click(screen.getByRole("option", { name: /Item 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /Discard/i }));

    expect(session.cancel).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("2");
  });
});
