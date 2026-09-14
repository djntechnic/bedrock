/**
 * @file test-utils.tsx
 * @module @djntechnic/bedrock-ui/test
 * @description Testing-library render helpers wrapping grid providers.
 */
import React, { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "../components/ui/tooltip";
import { AuthContext, type AuthContextValue } from "../context/AuthContext";
import { AppConfigContext } from "../context/AppConfigContext";

export function ensureDomMocks() {
  if (typeof HTMLElement !== "undefined") {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 800,
    });
  }
  if (typeof globalThis !== "undefined" && !(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

export interface RenderGridOptions extends RenderOptions {
  auth?: Partial<AuthContextValue>;
  route?: string;
}

export function renderWithGridProviders(
  ui: ReactElement,
  options?: RenderGridOptions,
) {
  ensureDomMocks();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const authValue: AuthContextValue = {
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    hasRole: () => false,
    login: async () => {
      throw new Error("Mock login");
    },
    loginWithGoogle: () => {},
    completeGoogleLogin: async () => {
      throw new Error("Mock login");
    },
    logout: async () => {},
    setSession: () => {},
    ...options?.auth,
  };

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[options?.route ?? "/"]}>
          <AuthContext.Provider value={authValue}>
            <AppConfigContext.Provider value={[] as any}>
              <TooltipProvider>{children}</TooltipProvider>
            </AppConfigContext.Provider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
