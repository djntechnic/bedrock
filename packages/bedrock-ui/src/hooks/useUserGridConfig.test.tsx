/**
 * @file useUserGridConfig.test.tsx
 * @description Regression cover for the unbounded PATCH/GET loop (#11) and the
 * idle-grid render loop that outlived it once the network was suppressed (#18).
 *
 * Both bugs were identity bugs, not data bugs. `useMutation` returns a fresh
 * result object every render; `schedulePatch` listed it as a dependency, so
 * every persist* callback was a new function each render. `DataGrid` persists
 * filter changes from an effect keyed on `persistFilters`, and an effect keyed
 * on a value that changes every render runs every render — so "persist on
 * change" quietly became "persist on render", and the PATCH's `onSuccess`
 * invalidation fed the next turn of the cycle.
 *
 * The assertions below are therefore about *identity across re-renders* and
 * *call counts*, not about payload shape. A test that only checked the PATCH
 * body would have passed throughout the entire life of the defect.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserGridConfig } from "./useUserGridConfig";

const patch = vi.fn().mockResolvedValue({ data: { data: null } });

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: null } }),
    patch: (...args: unknown[]) => patch(...args),
    delete: vi.fn().mockResolvedValue({ data: { data: null } }),
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

// A frozen module-level object, so `adminConfig` identity is not itself a
// source of churn — this test is about the mutation, and a config that
// changed every render would hide the thing under test.
const ADMIN_CONFIG = Object.freeze({
  isLoaded: true,
  columns: [],
  stickyFirstColumn: false,
});

vi.mock("./useGridConfig", () => ({
  useGridConfig: () => ADMIN_CONFIG,
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  patch.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("callback identity (#11, #18)", () => {
  it("keeps every persist callback stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useUserGridConfig("g1"), {
      wrapper,
    });

    const first = { ...result.current };
    rerender();
    rerender();
    rerender();

    // This is the whole defect: any one of these changing identity re-runs a
    // consumer effect keyed on it, which re-arms the 600 ms debounce forever.
    expect(result.current.persistFilters).toBe(first.persistFilters);
    expect(result.current.persistSorting).toBe(first.persistSorting);
    expect(result.current.persistColumnOrder).toBe(first.persistColumnOrder);
    expect(result.current.persistColumnVisible).toBe(first.persistColumnVisible);
    expect(result.current.setDashboardPin).toBe(first.setDashboardPin);
  });
});

describe("redundant persists (#18)", () => {
  it("does not re-arm the debounce for an unchanged payload", async () => {
    const { result } = renderHook(() => useUserGridConfig("g1"), { wrapper });

    act(() => {
      result.current.persistFilters([{ id: "status", value: "draft" }]);
    });
    act(() => {
      result.current.persistFilters([{ id: "status", value: "draft" }]);
      result.current.persistFilters([{ id: "status", value: "draft" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("still persists a genuine change", async () => {
    const { result } = renderHook(() => useUserGridConfig("g1"), { wrapper });

    act(() => {
      result.current.persistFilters([{ id: "status", value: "draft" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    act(() => {
      result.current.persistFilters([{ id: "status", value: "completed" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(patch).toHaveBeenCalledTimes(2);
  });

  it("tracks each field set separately, so an idle sort cannot mask a live filter", async () => {
    // Guarding on "the last payload" alone would let two alternating no-op
    // persists keep each other alive, since neither equals the other.
    const { result } = renderHook(() => useUserGridConfig("g1"), { wrapper });

    act(() => {
      result.current.persistFilters([{ id: "status", value: "draft" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    act(() => {
      result.current.persistSorting([{ id: "sku", desc: false }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Both are now no-ops and must stay that way, however they interleave.
    act(() => {
      result.current.persistFilters([{ id: "status", value: "draft" }]);
      result.current.persistSorting([{ id: "sku", desc: false }]);
      result.current.persistFilters([{ id: "status", value: "draft" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(patch).toHaveBeenCalledTimes(2);
  });
});
