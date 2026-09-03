import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { __clearNavItems, registerNavItems } from "../components/navRegistry";
import { useNavSettings, type NavItemSetting } from "./useNavSettings";

vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNavSettings", () => {
  beforeEach(() => {
    __clearNavItems();
    vi.restoreAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  });

  it("preserves sub-items sharing the parent destination route without dropping them", async () => {
    registerNavItems([
      {
        to: "/collection",
        label: "Collection",
        icon: () => null,
        children: [
          { to: "/collection", label: "My Collection" },
          { to: "/collection/sets", label: "My Sets" },
        ],
      },
    ]);

    const { result } = renderHook(() => useNavSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const collectionItem = result.current.navItems.find((i) => i.to === "/collection");
    expect(collectionItem).toBeDefined();
    expect(collectionItem?.children).toBeDefined();
    expect(collectionItem?.children).toHaveLength(2);
    expect(collectionItem?.children?.[0]).toMatchObject({
      to: "/collection",
      label: "My Collection",
    });
    expect(collectionItem?.children?.[1]).toMatchObject({
      to: "/collection/sets",
      label: "My Sets",
    });
  });

  it("applies settings overrides using composite keys for sub-items sharing parent route", async () => {
    const mockSettings: NavItemSetting[] = [
      {
        nav_key: "/collection",
        sort_order: 10,
        label_override: "Vault",
        is_hidden_override: 0,
      },
      {
        nav_key: "/collection::/collection",
        parent_key: "/collection",
        sort_order: 10,
        label_override: "All Cards In Vault",
        is_hidden_override: 0,
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockSettings });

    registerNavItems([
      {
        to: "/collection",
        label: "Collection",
        icon: () => null,
        children: [
          { to: "/collection", label: "My Collection" },
          { to: "/collection/sets", label: "My Sets" },
        ],
      },
    ]);

    const { result } = renderHook(() => useNavSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const collectionItem = result.current.navItems.find((i) => i.to === "/collection");
    expect(collectionItem).toBeDefined();
    expect(collectionItem?.label).toBe("Vault");
    expect(collectionItem?.children?.[0]).toMatchObject({
      to: "/collection",
      label: "All Cards In Vault",
    });
    expect(collectionItem?.children?.[1]).toMatchObject({
      to: "/collection/sets",
      label: "My Sets",
    });
  });

  it("supports fallback to cand.to when child override was saved under child.to", async () => {
    const mockSettings: NavItemSetting[] = [
      {
        nav_key: "/collection/sets",
        parent_key: "/collection",
        sort_order: 25,
        label_override: "Custom Sets Name",
        is_hidden_override: 0,
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockSettings });

    registerNavItems([
      {
        to: "/collection",
        label: "Collection",
        icon: () => null,
        children: [
          { to: "/collection", label: "My Collection" },
          { to: "/collection/sets", label: "My Sets" },
        ],
      },
    ]);

    const { result } = renderHook(() => useNavSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const collectionItem = result.current.navItems.find((i) => i.to === "/collection");
    const setsChild = collectionItem?.children?.find((c) => c.to === "/collection/sets");
    expect(setsChild).toMatchObject({
      to: "/collection/sets",
      label: "Custom Sets Name",
    });
  });

  it("preserves grouped items sharing route with parent", async () => {
    registerNavItems([
      {
        to: "/transactions",
        label: "Transactions",
        icon: () => null,
        groups: [
          {
            label: "Records",
            items: [
              { to: "/transactions", label: "Ledger" },
              { to: "/transactions/history", label: "History" },
            ],
          },
        ],
      },
    ]);

    const { result } = renderHook(() => useNavSettings(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const item = result.current.navItems.find((i) => i.to === "/transactions");
    expect(item).toBeDefined();
    expect(item?.groups).toHaveLength(1);
    expect(item?.groups?.[0].items).toHaveLength(2);
    expect(item?.groups?.[0].items[0]).toMatchObject({
      to: "/transactions",
      label: "Ledger",
    });
  });
});
