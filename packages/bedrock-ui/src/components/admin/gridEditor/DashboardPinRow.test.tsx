/**
 * @file DashboardPinRow.test.tsx
 * @description Cover for the Grid Editor's Pin to Dashboard control.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPinRow from "./DashboardPinRow";

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
});

describe("DashboardPinRow", () => {
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
