import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UserAccessProfileView from "./UserAccessProfileView";
import * as useUserOverridesModule from "../../hooks/useUserOverrides";

vi.mock("../../hooks/useUserOverrides", () => ({
  useUserOverrides: vi.fn(),
}));

describe("UserAccessProfileView", () => {
  const mockUseUserOverrides = vi.mocked(useUserOverridesModule.useUserOverrides);

  beforeEach(() => {
    mockUseUserOverrides.mockClear();
  });

  it("shows loading state", () => {
    mockUseUserOverrides.mockReturnValue({
      isLoading: true,
      profile: undefined,
      overrides: [],
      refetch: vi.fn(),
      updateOverrides: vi.fn(),
      isUpdating: false,
    });

    render(<UserAccessProfileView userId={1} />);
    expect(screen.getByText("Loading access profile...")).toBeInTheDocument();
  });

  it("shows empty state when no profile", () => {
    mockUseUserOverrides.mockReturnValue({
      isLoading: false,
      profile: undefined,
      overrides: [],
      refetch: vi.fn(),
      updateOverrides: vi.fn(),
      isUpdating: false,
    });

    render(<UserAccessProfileView userId={1} />);
    expect(screen.getByText("No access profile available.")).toBeInTheDocument();
  });

  it("renders user identity and roles", () => {
    mockUseUserOverrides.mockReturnValue({
      isLoading: false,
      profile: {
        user_id: 1,
        email: "test@example.com",
        is_superuser: true,
        roles: ["admin", "editor"],
        capabilities: {},
      },
      overrides: [],
      refetch: vi.fn(),
      updateOverrides: vi.fn(),
      isUpdating: false,
    });

    render(<UserAccessProfileView userId={1} />);
    expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/\(Superuser\)/)).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("renders capability matrix with inheritance badges", () => {
    mockUseUserOverrides.mockReturnValue({
      isLoading: false,
      profile: {
        user_id: 1,
        email: "test@example.com",
        is_superuser: false,
        roles: [],
        capabilities: {
          "mod-a": { view: true, update: false, delete: true, execute: false },
        },
      },
      overrides: [
        {
          module_id: 10,
          module_slug: "mod-a",
          module_label: "Module A",
          is_core: false,
          user_id: 1,
          can_view: null, // Role Default
          can_update: false, // Force Denied
          can_delete: true, // Force Granted
          can_execute: null, // Role Default (Denied)
        },
      ],
      refetch: vi.fn(),
      updateOverrides: vi.fn(),
      isUpdating: false,
    });

    render(<UserAccessProfileView userId={1} />);
    
    expect(screen.getByText("Module A")).toBeInTheDocument();
    
    const roleDefaultGranted = screen.getAllByText("Role Default (Granted)");
    expect(roleDefaultGranted.length).toBeGreaterThan(0);
    
    const forceDenied = screen.getAllByText("Force Denied (Override)");
    expect(forceDenied.length).toBeGreaterThan(0);

    const forceGranted = screen.getAllByText("Force Granted (Override)");
    expect(forceGranted.length).toBeGreaterThan(0);

    const roleDefaultDenied = screen.getAllByText("Role Default (Denied)");
    expect(roleDefaultDenied.length).toBeGreaterThan(0);
  });
});
