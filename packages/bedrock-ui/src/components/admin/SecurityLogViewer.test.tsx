/**
 * @file SecurityLogViewer.test.tsx
 * @description Cover for `<SecurityLogViewer>` (#40).
 *
 * `useSecurityEvents` is mocked at the hook layer, the `DataGrid.test.tsx`
 * pattern: it is the one hook this screen takes its data from, so replacing
 * it lets every test assert on the params the screen actually sent and the
 * rows it actually rendered, without a `QueryClientProvider` or a server.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SecurityEvent, SecurityEventsQuery } from "../../hooks/useAdminPlatform";

const useSecurityEvents = vi.fn();

vi.mock("../../hooks/useAdminPlatform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useAdminPlatform")>()),
  useSecurityEvents: (params: SecurityEventsQuery) => useSecurityEvents(params),
}));

import SecurityLogViewer, { PLATFORM_EVENT_TYPES } from "./SecurityLogViewer";

const event = (overrides: Partial<SecurityEvent> = {}): SecurityEvent => ({
  event_id: 1,
  event_ts: "2026-01-01T00:00:00Z",
  event_type: "login_success",
  user_id: 7,
  user_email: "operator@example.com",
  target_user_id: null,
  target_user_email: null,
  actor_ip: "10.0.0.1",
  user_agent: null,
  detail: null,
  ...overrides,
});

function mockResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { data: { events: [], limit: 100, offset: 0 } },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  useSecurityEvents.mockReset();
});

describe("PLATFORM_EVENT_TYPES", () => {
  it("carries the platform's own 23 auth event types, sorted", () => {
    expect(useSecurityEvents).not.toHaveBeenCalled(); // sanity: mock is fresh
    expect(PLATFORM_EVENT_TYPES).toHaveLength(23);
    expect([...PLATFORM_EVENT_TYPES]).toEqual([...PLATFORM_EVENT_TYPES].sort());
    expect(PLATFORM_EVENT_TYPES).not.toContain("config_setting_changed");
  });
});

describe("SecurityLogViewer", () => {
  it("renders the rows the hook returns, keyed by event_id", () => {
    useSecurityEvents.mockReturnValue(
      mockResult({
        data: {
          data: {
            events: [
              event({ event_id: 11, event_type: "login_success" }),
              event({ event_id: 12, event_type: "logout" }),
            ],
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
    render(<SecurityLogViewer />);
    expect(screen.getByText("login_success")).toBeTruthy();
    expect(screen.getByText("logout")).toBeTruthy();
    expect(screen.getAllByText("operator@example.com")).toHaveLength(2);
  });

  it("renders the empty state for an empty response", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer />);
    expect(screen.getByText("No security events")).toBeTruthy();
  });

  it("renders an error message on isError", () => {
    useSecurityEvents.mockReturnValue(mockResult({ isError: true }));
    render(<SecurityLogViewer />);
    expect(screen.getByText("Failed to load security events.")).toBeTruthy();
  });

  it("passes event_type to the hook, never the \"all\" sentinel", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer />);
    useSecurityEvents.mockClear();

    fireEvent.click(screen.getByLabelText("Event type"));
    fireEvent.click(screen.getByText("login_failed"));

    const lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.event_type).toBe("login_failed");
  });

  it("leaves event_type undefined for the default \"all\" selection", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer />);
    const lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.event_type).toBeUndefined();
  });

  it("passes a number for a typed user id, and undefined once cleared", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer />);
    const input = screen.getByLabelText("User ID");

    fireEvent.change(input, { target: { value: "42" } });
    let lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.user_id).toBe(42);

    fireEvent.change(input, { target: { value: "" } });
    lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.user_id).toBeUndefined();
  });

  it("rejects non-digit characters from the user id input", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer />);
    const input = screen.getByLabelText("User ID") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "4a2b" } });
    expect(input.value).toBe("42");
  });

  it("resets offset to 0 when a filter changes after paging", () => {
    useSecurityEvents.mockReturnValue(
      mockResult({
        data: {
          data: {
            events: Array.from({ length: 100 }, (_, i) => event({ event_id: i })),
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
    render(<SecurityLogViewer />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    let lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.offset).toBe(100);

    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "9" } });
    lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.offset).toBe(0);
  });

  it("advances offset by pageSize on Next, disables Previous on the first page", () => {
    useSecurityEvents.mockReturnValue(
      mockResult({
        data: {
          data: {
            events: Array.from({ length: 100 }, (_, i) => event({ event_id: i })),
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
    render(<SecurityLogViewer pageSize={100} />);

    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const lastCall = useSecurityEvents.mock.calls.at(-1)?.[0] as SecurityEventsQuery;
    expect(lastCall.offset).toBe(100);
  });

  it("disables Next when the returned page is shorter than pageSize", () => {
    useSecurityEvents.mockReturnValue(
      mockResult({
        data: {
          data: {
            events: [event({ event_id: 1 })],
            limit: 100,
            offset: 0,
          },
        },
      }),
    );
    render(<SecurityLogViewer />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("adds eventTypes to the options without dropping the platform's own", () => {
    useSecurityEvents.mockReturnValue(mockResult());
    render(<SecurityLogViewer eventTypes={["app_specific_event"]} />);

    fireEvent.click(screen.getByLabelText("Event type"));
    expect(screen.getByText("app_specific_event")).toBeTruthy();
    expect(screen.getByText("login_success")).toBeTruthy();
  });
});
