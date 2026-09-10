import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpPopover from "./HelpPopover";
import * as useHelpConfigModule from "../hooks/useHelpConfig";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("HelpPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button and opens popover displaying title, markdown body, and doc link", async () => {
    vi.spyOn(useHelpConfigModule, "useHelpConfig").mockReturnValue({
      helpEntry: {
        help_entry_id: 1,
        topic_key: "grid_shortcuts",
        title: "Keyboard Shortcuts",
        body_markdown: "Press **Ctrl+C** to copy and **Ctrl+V** to paste.",
        doc_url: "https://example.com/shortcuts",
        doc_label: "Learn More",
        created_at: "2026-09-10T12:00:00",
        created_by: "System",
        modified_at: "2026-09-10T12:00:00",
        modified_by: "System",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<HelpPopover topic="grid_shortcuts" />, {
      wrapper: createWrapper(),
    });

    const triggerButton = screen.getByRole("button", { name: /help/i });
    expect(triggerButton).toBeInTheDocument();

    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
      // Body content check
      expect(screen.getByText(/Press/)).toBeInTheDocument();
      // Doc link button check
      const docLink = screen.getByRole("link", { name: /Learn More/i });
      expect(docLink).toHaveAttribute("href", "https://example.com/shortcuts");
      expect(docLink).toHaveAttribute("target", "_blank");
    });
  });

  it("handles entry with no doc link gracefully", async () => {
    vi.spyOn(useHelpConfigModule, "useHelpConfig").mockReturnValue({
      helpEntry: {
        help_entry_id: 2,
        topic_key: "simple_topic",
        title: "Simple Topic",
        body_markdown: "Simple help message.",
        doc_url: null,
        doc_label: null,
        created_at: "2026-09-10T12:00:00",
        created_by: "System",
        modified_at: "2026-09-10T12:00:00",
        modified_by: "System",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<HelpPopover topic="simple_topic" />, {
      wrapper: createWrapper(),
    });

    const triggerButton = screen.getByRole("button", { name: /help/i });
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText("Simple Topic")).toBeInTheDocument();
      expect(screen.getByText("Simple help message.")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });
});
