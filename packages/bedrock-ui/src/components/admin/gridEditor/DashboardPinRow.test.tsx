/**
 * @file DashboardPinRow.test.tsx
 * @description Cover for the Grid Editor's Pin to Dashboard control.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPinRow from "./DashboardPinRow";
import {
  __clearDashboardPinHost,
  registerDashboardPinHost,
} from "../../grids/dashboardPinRegistry";

const setDashboardPin = vi.fn();
let pinState = { dashboardPin: false, isReady: true };

vi.mock("../../../hooks/useUserGridConfig", () => ({
  useUserGridConfig: (gridId: string) => {
    seenGridId = gridId;
    return { ...pinState, setDashboardPin };
  },
}));

let seenGridId = "";

beforeEach(() => {
  setDashboardPin.mockClear();
  pinState = { dashboardPin: false, isReady: true };
  seenGridId = "";
  // The control is host-gated (#36); every test below is about how it behaves
  // for a host that does render pinned grids. The one that isn't clears it.
  registerDashboardPinHost();
});

describe("DashboardPinRow", () => {
  it("renders nothing for a host with no dashboard", () => {
    // The point of the gate: no switch at all, rather than a preference an
    // operator can set and never see honoured anywhere.
    __clearDashboardPinHost();
    const { container } = render(<DashboardPinRow gridId="g1" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("hides the whole section, not just the switch", () => {
    // "My Preferences" with nothing under it reads as a panel that failed to
    // load, so the CollapsibleSection goes with it.
    __clearDashboardPinHost();
    render(<DashboardPinRow gridId="g1" />);
    expect(screen.queryByText("My Preferences")).toBeNull();
  });

  it("reads the pin for the grid being edited", () => {
    render(<DashboardPinRow gridId="leaderboard_batting" />);
    expect(seenGridId).toBe("leaderboard_batting");
  });

  it("reflects a pin that is already set", () => {
    pinState = { dashboardPin: true, isReady: true };
    render(<DashboardPinRow gridId="g1" />);
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("persists the toggle immediately, without waiting for Save", async () => {
    // The distinction that makes this control worth its own component: it is a
    // user preference, not part of the grid draft.
    render(<DashboardPinRow gridId="g1" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(setDashboardPin).toHaveBeenCalledWith(true);
  });

  it("stays inert until the preference has loaded", () => {
    // Otherwise the switch renders unchecked for a grid that is in fact
    // pinned, and the first click would unpin nothing while writing `true`.
    pinState = { dashboardPin: false, isReady: false };
    render(<DashboardPinRow gridId="g1" />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
