import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SaveBar from "./SaveBar";
import type { EditSession } from "../hooks/useEditSession";
import { Can, type CanProps } from "../hooks/useSecurity";

vi.mock("../hooks/useSecurity", () => ({
  useSecurity: () => ({
    can: (module: string, action: string) => module === "allowed" && action === "update",
  }),
  Can: ({ module, action, children }: CanProps) => {
    const isAllowed = module === "allowed" && action === "update";
    return isAllowed ? <>{children}</> : null;
  },
}));

function mockSession(overrides: Partial<EditSession> = {}): EditSession {
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

describe("SaveBar", () => {
  it("disables Save and Cancel when clean", () => {
    const session = mockSession({ dirty: false });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
  });

  it("enables buttons and shows Unsaved changes status when dirty", () => {
    const session = mockSession({ dirty: true });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).not.toBeDisabled();
    expect(screen.getByRole("status").textContent).toBe("Unsaved changes");

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(session.save).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(session.cancel).toHaveBeenCalled();
  });

  it("shows saving spinner and disables buttons during save", () => {
    const session = mockSession({ dirty: true, saving: true, status: "saving" });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    expect(screen.getByRole("status").textContent).toBe("Saving…");
  });

  it("completely unmounts when wrapped in Can without permission per §S010", () => {
    const session = mockSession({ dirty: true });
    const { rerender } = render(
      <Can module="denied" action="update">
        <SaveBar session={session} />
      </Can>
    );

    expect(screen.queryByTestId("save-bar")).toBeNull();

    rerender(
      <Can module="allowed" action="update">
        <SaveBar session={session} />
      </Can>
    );
    expect(screen.getByTestId("save-bar")).toBeDefined();
  });
});
