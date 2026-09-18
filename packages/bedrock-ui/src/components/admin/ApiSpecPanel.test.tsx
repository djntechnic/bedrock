/**
 * @file ApiSpecPanel.test.tsx
 * @description Tests for the Admin → Health → Spec interactive API docs panel in @djntechnic/bedrock-ui.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub Swagger UI widget so tests stay fast and jsdom-safe.
vi.mock("swagger-ui-react", () => ({
  default: ({ url }: { url: string }) => (
    <div data-testid="swagger-ui" data-url={url} />
  ),
}));

// Mock logger
vi.mock("../../utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import ApiSpecPanel, {
  OPENAPI_SPEC_URL,
  POSTMAN_COLLECTION_URL,
} from "./ApiSpecPanel";
import { log } from "../../utils/logger";

describe("ApiSpecPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both static-snapshot download anchors with correct targets", () => {
    render(<ApiSpecPanel />);

    const openapi = screen.getByRole("link", { name: /Export OpenAPI Spec/i });
    expect(openapi).toHaveAttribute("href", OPENAPI_SPEC_URL);
    expect(openapi).toHaveAttribute("download");

    const postman = screen.getByRole("link", { name: /Export Postman Collection/i });
    expect(postman).toHaveAttribute("href", POSTMAN_COLLECTION_URL);
    expect(postman).toHaveAttribute("download");
  });

  it("gives the download anchors an accessible keyboard focus ring", () => {
    render(<ApiSpecPanel />);
    const openapi = screen.getByRole("link", { name: /Export OpenAPI Spec/i });
    expect(openapi.className).toContain("focus-visible:ring-2");
  });

  it("resolves the spec/collection URLs against backend origin", () => {
    expect(OPENAPI_SPEC_URL).toMatch(/\/openapi\.json$/);
    expect(POSTMAN_COLLECTION_URL).toMatch(
      /\/static\/collections\/.*\.postman_collection\.json$/,
    );
  });

  it("mounts the embedded Swagger UI pointed at the live OpenAPI spec", async () => {
    render(<ApiSpecPanel />);
    const swagger = await screen.findByTestId("swagger-ui");
    expect(swagger).toHaveAttribute("data-url", OPENAPI_SPEC_URL);
  });

  it("logs a spec-view telemetry event on activation", () => {
    render(<ApiSpecPanel />);
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ gridId: "ADMIN_SPEC_VIEW", action: "ADMIN_SPEC_VIEW" }),
      expect.any(String),
    );
  });
});
