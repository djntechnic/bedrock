import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import { useModules } from "../hooks/useModules";
import { useSecurity } from "../hooks/useSecurity";

vi.mock("../hooks/useAuth");
vi.mock("../hooks/useModules");
vi.mock("../hooks/useSecurity");

describe("ProtectedRoute", () => {
  it("renders immediately without waiting on securityLoading when no action is required", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      hasRole: vi.fn(),
      isLoading: false,
    } as any);

    vi.mocked(useModules).mockReturnValue({
      hasModule: vi.fn().mockReturnValue(true),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSecurity).mockReturnValue({
      can: vi.fn(),
      isLoading: true, // Should not block rendering because action is not passed
      isError: false,
    } as any);

    render(
      <MemoryRouter>
        <ProtectedRoute allowAnon requiredModule="dashboard">
          <div data-testid="protected-content">Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("renders a connection retry view instead of ModuleDisabled when useModules has isError", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { user_id: 1, email: "user@test.com" } as any,
      isAdmin: false,
      hasRole: vi.fn().mockReturnValue(true),
      isLoading: false,
    } as any);

    vi.mocked(useModules).mockReturnValue({
      hasModule: vi.fn().mockReturnValue(false),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useSecurity).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
      isError: false,
    } as any);

    render(
      <MemoryRouter>
        <ProtectedRoute requiredModule="dashboard">
          <div data-testid="protected-content">Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText(/Feature not enabled for your account/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to verify permissions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
