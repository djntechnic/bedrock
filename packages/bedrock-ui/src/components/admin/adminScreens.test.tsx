/**
 * @file adminScreens.test.tsx
 * @description Cover for the admin screens the platform now ships.
 *
 * The rendering itself is thin — hook in, table out. What is worth pinning is
 * the handful of decisions each screen makes on the way: which rows it hides,
 * which spellings of "true" it believes, and what the profile form refuses to
 * send to the server.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { groupByCategory, boolValue } from "./ConfigEditor";
import { shortUserAgent } from "./UsersPanel";
import { formatBytes } from "./PlatformHealthPanel";
import type { ConfigSetting } from "../../hooks/useAdminPlatform";

const setting = (key: string, category: string): ConfigSetting =>
  ({ key, category, value: "1", value_type: "bool" }) as ConfigSetting;

describe("groupByCategory", () => {
  it("groups rows and keeps first-seen category order", () => {
    const groups = groupByCategory([
      setting("a", "storage"),
      setting("b", "listings"),
      setting("c", "storage"),
    ]);
    expect(groups.map(([name]) => name)).toEqual(["storage", "listings"]);
    expect(groups[0][1].map((s) => s.key)).toEqual(["a", "c"]);
  });

  it("files a row with no category under one bucket rather than dropping it", () => {
    const groups = groupByCategory([setting("a", ""), setting("b", "")]);
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("uncategorised");
    expect(groups[0][1]).toHaveLength(2);
  });

  it("returns nothing for no settings", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("boolValue", () => {
  it("accepts both spellings the backend writes for true", () => {
    expect(boolValue("true")).toBe(true);
    expect(boolValue("1")).toBe(true);
  });

  it("treats anything else, including null, as false", () => {
    // A switch handed `undefined` would flip from uncontrolled to controlled;
    // an unset key has to read as off.
    expect(boolValue("false")).toBe(false);
    expect(boolValue("0")).toBe(false);
    expect(boolValue("")).toBe(false);
    expect(boolValue(null)).toBe(false);
  });
});

describe("shortUserAgent", () => {
  it("passes a short agent through untouched", () => {
    expect(shortUserAgent("curl/8.4.0")).toBe("curl/8.4.0");
  });

  it("truncates a browser-length agent to something a cell can hold", () => {
    const long = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML)";
    const short = shortUserAgent(long);
    expect(short).toHaveLength(49); // 48 characters plus the ellipsis
    expect(short.endsWith("…")).toBe(true);
  });

  it("renders an em dash for a session with no agent recorded", () => {
    expect(shortUserAgent(null)).toBe("—");
  });
});

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

  it("stops at GB rather than inventing a unit", () => {
    expect(formatBytes(4096 * 1024 ** 3)).toBe("4096.0 GB");
  });

  it("refuses to divide by a zero or nonsense size", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

// ── ProfilePage ──────────────────────────────────────────────────────────────

const mutate = vi.fn();
const authState = { user: null as unknown };
const passwordState = { isPending: false, isError: false, error: null as unknown };

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => authState,
}));
vi.mock("../../hooks/useProfile", () => ({
  useChangePassword: () => ({ mutate, ...passwordState }),
}));

async function fillPasswords(next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "old-password" },
  });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mutate.mockReset();
    authState.user = {
      email: "operator@example.com",
      display_name: "Operator",
      roles: ["admin"],
      last_login_at: null,
    };
    passwordState.isPending = false;
    passwordState.isError = false;
    passwordState.error = null;
  });

  it("shows the identity the auth context already holds", async () => {
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    expect(screen.getByText("operator@example.com")).toBeTruthy();
    expect(screen.getByText("Operator")).toBeTruthy();
    expect(screen.getByText("admin")).toBeTruthy();
    // Never signed in reads as a dash, not as "Invalid Date".
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("says so rather than blanking when nobody is signed in", async () => {
    authState.user = null;
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    expect(screen.getByText("Not signed in.")).toBeTruthy();
  });

  it("refuses a short password without asking the server", async () => {
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    await fillPasswords("short", "short");
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("at least 8");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("refuses a mismatched confirmation without asking the server", async () => {
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    await fillPasswords("long-enough-1", "long-enough-2");
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("do not match");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends the current and new password once both objections clear", async () => {
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    await fillPasswords("long-enough-1", "long-enough-1");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      current_password: "old-password",
      new_password: "long-enough-1",
    });
  });

  it("blames the typed password only on a 401", async () => {
    passwordState.isError = true;
    passwordState.error = {
      isAxiosError: true,
      response: { status: 401 },
    };
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    expect(screen.getByRole("alert").textContent).toContain("Current password is incorrect");
  });

  it("reads any other failure as a server fault", async () => {
    passwordState.isError = true;
    passwordState.error = {
      isAxiosError: true,
      response: { status: 500 },
    };
    const { default: ProfilePage } = await import("./ProfilePage");
    render(<ProfilePage />);
    expect(screen.getByRole("alert").textContent).toContain("Could not change the password");
  });
});
