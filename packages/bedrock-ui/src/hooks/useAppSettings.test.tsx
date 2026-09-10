import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppSettings } from "./useAppSettings";
import { AppConfigContext, type AppConfig } from "../context/AppConfigContext";
import { apiClient } from "../api/client";

describe("useAppSettings", () => {
  it("resolves settings from AppConfigContext without calling /api/v1/admin/config", () => {
    const getSpy = vi.spyOn(apiClient, "get");
    const queryClient = new QueryClient();

    const mockAppConfig: AppConfig = {
      current_season: 2026,
      seasons: [],
      inventory_statuses: [],
      ui_query_config: {},
      app_config: {
        system_app_name: "Test App",
        grid_tooltip_delay_duration: "450",
        logging_level: "DEBUG",
        logging_disable_console_in_prod: "true",
        logging_redact_keys: '["secret_token"]',
        shortcuts_enabled: "true",
        shortcuts_help_key: "?",
        shortcuts_sequence_timeout_ms: "1200",
      },
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AppConfigContext.Provider value={mockAppConfig}>
          {children}
        </AppConfigContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAppSettings(), { wrapper });

    expect(result.current.system.appName).toBe("Test App");
    expect(result.current.grid.tooltipDelayDuration).toBe(450);
    expect(result.current.logging.level).toBe("DEBUG");
    expect(result.current.logging.disableConsoleInProd).toBe(true);
    expect(result.current.logging.redactKeys).toEqual(["secret_token"]);
    expect(result.current.shortcuts.enabled).toBe(true);
    expect(result.current.shortcuts.helpKey).toBe("?");
    expect(result.current.shortcuts.sequenceTimeoutMs).toBe(1200);

    // Verify zero calls to apiClient.get for /admin/config
    const adminConfigCalls = getSpy.mock.calls.filter((call) =>
      String(call[0]).includes("/api/v1/admin/config")
    );
    expect(adminConfigCalls.length).toBe(0);

    getSpy.mockRestore();
  });
});
