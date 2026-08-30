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
    } as any);

    vi.mocked(useSecurity).mockReturnValue({
      can: vi.fn(),
      isLoading: true, // Should not block rendering because action is not passed
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
});
