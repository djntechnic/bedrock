/**
 * @file ApiRoutesPanel.test.tsx
 * @description Tests for the Admin → Health → API Routes Explorer panel.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ApiRoutesPanel, { methodColor } from "./ApiRoutesPanel";
import type { ApiHealthEntry } from "../../hooks/useAdminPlatform";

const mockRoutes: ApiHealthEntry[] = [
  {
    method: "GET",
    path: "/api/v1/players",
    name: "get_players",
    hits: 1500,
    hits_24h: 120,
    errors: 0,
    last_accessed: "2026-09-17T12:00:00Z",
    status: "Healthy",
    summary: "List all active players",
    description: "Returns paginated player list with stat aggregations.",
    parameters: [
      {
        name: "limit",
        in: "query",
        required: false,
        type: "integer",
        description: "Number of rows",
        default: 50,
      },
    ],
    body_fields: [],
    response_schema: "PlayerListResponse",
    tags: ["players"],
    documented: true,
  },
  {
    method: "POST",
    path: "/api/v1/cards",
    name: "create_card",
    hits: 50,
    hits_24h: 10,
    errors: 2,
    last_accessed: "2026-09-17T14:30:00Z",
    status: "Healthy",
    summary: "Create a new inventory card",
    description: "Inserts a collectible card row.",
    parameters: [],
    body_fields: [
      {
        name: "title",
        type: "string",
        required: true,
        description: "Card title",
        default: null,
      },
    ],
    response_schema: "CardResponse",
    tags: ["inventory"],
    documented: false,
  },
];

vi.mock("../../hooks/useAdminPlatform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useAdminPlatform")>();
  return {
    ...actual,
    useApiHealth: () => ({
      data: { data: mockRoutes },
      isLoading: false,
    }),
  };
});

describe("ApiRoutesPanel", () => {
  it("renders KPI summary tiles with calculated metrics from hook or props", () => {
    render(<ApiRoutesPanel />);

    expect(screen.getByText("Total Hits")).toBeInTheDocument();
    expect(screen.getByText("1,550")).toBeInTheDocument(); // 1500 + 50
    expect(screen.getByText("Hits (24h)")).toBeInTheDocument();
    expect(screen.getByText("130")).toBeInTheDocument(); // 120 + 10
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Undocumented")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("filters routes by search text", () => {
    render(<ApiRoutesPanel routes={mockRoutes} isLoading={false} />);

    expect(screen.getByText("/api/v1/players")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/cards")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Filter endpoints...");
    fireEvent.change(input, { target: { value: "cards" } });

    expect(screen.queryByText("/api/v1/players")).not.toBeInTheDocument();
    expect(screen.getByText("/api/v1/cards")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 endpoints")).toBeInTheDocument();
  });

  it("filters routes when Undocumented only is toggled", () => {
    render(<ApiRoutesPanel routes={mockRoutes} isLoading={false} />);

    const checkbox = screen.getByLabelText("Undocumented only");
    fireEvent.click(checkbox);

    expect(screen.queryByText("/api/v1/players")).not.toBeInTheDocument();
    expect(screen.getByText("/api/v1/cards")).toBeInTheDocument();
  });

  it("renders parameter and body field tables inside route details", () => {
    render(<ApiRoutesPanel routes={mockRoutes} isLoading={false} />);

    // Check parameters table for GET /api/v1/players
    expect(screen.getByText("limit")).toBeInTheDocument();
    expect(screen.getByText("query")).toBeInTheDocument();

    // Check request body table for POST /api/v1/cards
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("Card title")).toBeInTheDocument();
  });

  it("formats method colors appropriately", () => {
    expect(methodColor("GET")).toContain("positive");
    expect(methodColor("POST")).toContain("info");
    expect(methodColor("PATCH")).toContain("warning");
    expect(methodColor("DELETE")).toContain("rose");
  });
});
