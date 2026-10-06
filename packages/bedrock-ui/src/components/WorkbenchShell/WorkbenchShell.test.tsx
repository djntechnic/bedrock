/**
 * @file WorkbenchShell.test.tsx
 * @module @djntechnic/bedrock-ui/components/WorkbenchShell
 * @description The rail-and-detail layout primitive (spec §4.4). It is pure
 * layout: every behaviour asserted here is a prop in and a callback out, so
 * the tests drive it with plain state and spies, no data layer.
 */
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { AuthContext, type AuthContextValue } from "../../context/AuthContext";
import { queryKeys as platformQueryKeys } from "../../hooks/queryKeys";
import type { PermissionsMap } from "../../hooks/useSecurity";
import { TooltipProvider } from "../ui/tooltip";
import WorkbenchShell, { type WorkbenchFilter } from "./WorkbenchShell";
import { RAIL_COLLAPSED_KEY } from "./useWorkbenchRail";

// Radix Tooltip measures its arrow with ResizeObserver, which jsdom lacks.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderWithTooltips(ui: ReactNode) {
  return render(<>{ui}</>, { wrapper: TooltipProvider });
}

type Rec = { id: number; name: string };

const RECORDS: Rec[] = [
  { id: 1, name: "Alpha" },
  { id: 2, name: "Bravo" },
  { id: 3, name: "Charlie" },
];

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "fields", label: "Fields" },
];

const TOKEN = "test-token";

function authValue(isAdmin: boolean): AuthContextValue {
  return {
    user: null,
    token: TOKEN,
    isLoading: false,
    isAuthenticated: true,
    isAdmin,
    hasRole: () => false,
    login: async () => {
      throw new Error("not in tests");
    },
    loginWithGoogle: () => {},
    completeGoogleLogin: async () => {
      throw new Error("not in tests");
    },
    logout: async () => {},
    setSession: () => {},
  };
}

/** Seeds the platform permissions cache so `PermissionButton` resolves without a fetch. */
function Providers({
  children,
  permissions = { entities: { view: true, update: true, delete: true, execute: false } },
  isAdmin = false,
}: {
  children: ReactNode;
  permissions?: PermissionsMap;
  isAdmin?: boolean;
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(platformQueryKeys.security.myPermissions(TOKEN), permissions);
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={authValue(isAdmin)}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

type HarnessProps = {
  items?: Rec[];
  dirty?: boolean;
  onSelect?: (id: number) => void;
  onFilterChange?: (f: WorkbenchFilter) => void;
  onSearchChange?: (s: string) => void;
  onTabChange?: (t: string) => void;
  onCreate?: () => void;
  onDiscard?: () => void;
  createDisabledReason?: string;
  headerActions?: ReactNode;
  bodyOverride?: ReactNode;
  /** The detail owns its own tabs, so the shell gets none. */
  bare?: boolean;
  /** Replaces the Active/Archived/All control; also makes filter props optional. */
  railHeader?: ReactNode;
  /** Leave filter props unset (the shell must not require them). */
  noFilter?: boolean;
  /** Drop `onCreate`/`createPermission` entirely. */
  noCreate?: boolean;
};

/** Owns the controlled state the way a page would, and forwards every callback to a spy. */
function Harness(props: HarnessProps) {
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [filter, setFilter] = useState<WorkbenchFilter>("active");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  return (
    <WorkbenchShell<Rec>
      title="Entities"
      railLabel="Entities"
      items={props.items ?? RECORDS}
      renderCard={(r) => <span>{r.name}</span>}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id as number);
        props.onSelect?.(id as number);
      }}
      railHeader={props.railHeader}
      filter={props.noFilter || props.railHeader ? undefined : filter}
      onFilterChange={
        props.noFilter || props.railHeader
          ? undefined
          : (f) => {
              setFilter(f);
              props.onFilterChange?.(f);
            }
      }
      search={search}
      onSearchChange={(s) => {
        setSearch(s);
        props.onSearchChange?.(s);
      }}
      onCreate={props.noCreate ? undefined : () => props.onCreate?.()}
      createPermission={props.noCreate ? undefined : { module: "entities", action: "update" }}
      createDisabledReason={props.createDisabledReason}
      headerActions={props.headerActions}
      bodyOverride={props.bodyOverride}
      tabs={props.bare ? undefined : TABS}
      activeTab={props.bare ? undefined : tab}
      onTabChange={(t) => {
        setTab(t);
        props.onTabChange?.(t);
      }}
      dirty={props.dirty ?? false}
      onDiscard={props.onDiscard}
      detailHeader={<h2>Selected {selectedId}</h2>}
      footer={<div>Save bar</div>}
    >
      <p>Body of {tab}</p>
    </WorkbenchShell>
  );
}

function renderShell(props: HarnessProps = {}, providerProps: { permissions?: PermissionsMap; isAdmin?: boolean } = {}) {
  return renderWithTooltips(
    <Providers {...providerProps}>
      <Harness {...props} />
    </Providers>,
  );
}

/** Fakes the two queries the rail reads: the 1280px breakpoint and reduced motion. */
function stubMedia(width: number, reducedMotion = false) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width: 1280px") ? width >= 1280 : query.includes("prefers-reduced-motion") && reducedMotion,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("WorkbenchShell", () => {
  beforeEach(() => {
    localStorage.clear();
    stubMedia(1600);
  });
  afterEach(() => localStorage.clear());

  it("fires onFilterChange from the Active | Archived | All segmented filter", async () => {
    const onFilterChange = vi.fn();
    renderShell({ onFilterChange });
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));
    expect(onFilterChange).toHaveBeenCalledWith("archived");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onFilterChange).toHaveBeenLastCalledWith("all");
  });

  it("keeps search controlled and reports every keystroke without a debounce", async () => {
    const onSearchChange = vi.fn();
    renderShell({ onSearchChange });
    const search = screen.getByRole("searchbox", { name: "Search Entities" });
    await userEvent.type(search, "ab");
    // Synchronous, one call per keystroke: a debounce would leave zero calls here.
    expect(onSearchChange.mock.calls.map((c) => c[0])).toEqual(["a", "ab"]);
    expect(search).toHaveValue("ab");
  });

  it("moves through the cards with ArrowDown/ArrowUp and selects with Enter", async () => {
    const onSelect = vi.fn();
    renderShell({ onSelect });
    const list = screen.getByRole("listbox", { name: "Entities" });
    list.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "Bravo" }).id);
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");
    // Clamped at the last card, then back one: Bravo.
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(within(list).getByRole("option", { name: "Bravo" })).toHaveAttribute("aria-selected", "true");
  });

  it("jumps with Home/End and scrolls the active card into view", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderShell();
    const list = screen.getByRole("listbox", { name: "Entities" });
    list.focus();
    await userEvent.keyboard("{End}");
    const charlie = within(list).getByRole("option", { name: "Charlie" });
    expect(list).toHaveAttribute("aria-activedescendant", charlie.id);
    expect(scroll.mock.contexts).toContain(charlie);
    await userEvent.keyboard("{Home}");
    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "Alpha" }).id);
    scroll.mockRestore();
  });

  it("follows an external selection change with the keyboard highlight", () => {
    const view = renderShell();
    view.rerender(
      <Providers>
        <Harness items={[RECORDS[2], RECORDS[0]]} />
      </Providers>,
    );
    const list = screen.getByRole("listbox", { name: "Entities" });
    // Alpha (selected) moved to index 1; the highlight follows the id, not the index.
    expect(list).toHaveAttribute("aria-activedescendant", within(list).getByRole("option", { name: "Alpha" }).id);
  });

  it("selects a card on click", async () => {
    const onSelect = vi.fn();
    renderShell({ onSelect });
    await userEvent.click(screen.getByRole("option", { name: "Charlie" }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("blocks card and tab changes while dirty until Discard is chosen", async () => {
    const onSelect = vi.fn();
    const onTabChange = vi.fn();
    const onDiscard = vi.fn();
    renderShell({ dirty: true, onSelect, onTabChange, onDiscard });

    await userEvent.click(screen.getByRole("option", { name: "Charlie" }));
    expect(onSelect).not.toHaveBeenCalled();
    const guard = screen.getByRole("group", { name: "Discard unsaved changes?" });
    await userEvent.click(within(guard).getByRole("button", { name: "Keep editing" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Discard unsaved changes?" })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Fields" }));
    expect(onTabChange).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole("group", { name: "Discard unsaved changes?" })).getByRole("button", {
        name: "Discard",
      }),
    );
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("fields");
  });

  it("guards filter switching and create while dirty", async () => {
    const onFilterChange = vi.fn();
    const onCreate = vi.fn();
    renderShell({ dirty: true, onFilterChange, onCreate });
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));
    expect(onFilterChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onFilterChange).toHaveBeenCalledWith("archived");

    await userEvent.click(screen.getByRole("button", { name: "New" }));
    expect(onCreate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("returns focus on Keep editing and dismisses the guard with Escape", async () => {
    const onSelect = vi.fn();
    renderShell({ dirty: true, onSelect });
    const list = screen.getByRole("listbox", { name: "Entities" });
    list.focus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    const guard = screen.getByRole("group", { name: "Discard unsaved changes?" });
    expect(within(guard).getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Discard unsaved changes?" })).toBeNull();
    expect(list).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("drops a parked navigation once the detail is no longer dirty", async () => {
    const view = renderShell({ dirty: true });
    await userEvent.click(screen.getByRole("option", { name: "Charlie" }));
    expect(screen.getByRole("group", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    view.rerender(
      <Providers>
        <Harness dirty={false} />
      </Providers>,
    );
    expect(screen.queryByRole("group", { name: "Discard unsaved changes?" })).toBeNull();
  });

  it("does not guard a clean detail", async () => {
    const onSelect = vi.fn();
    renderShell({ onSelect });
    await userEvent.click(screen.getByRole("option", { name: "Bravo" }));
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole("group", { name: "Discard unsaved changes?" })).toBeNull();
  });

  it("disables create and surfaces createDisabledReason", async () => {
    const onCreate = vi.fn();
    renderShell({ onCreate, createDisabledReason: "Pick an entity first" });
    const create = screen.getByRole("button", { name: "New" });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription("Pick an entity first");
    expect(create).toHaveAttribute("title", "Pick an entity first");
  });

  it("disables create through PermissionButton when the caller lacks the permission", () => {
    renderShell({}, { permissions: { entities: { view: true, update: false, delete: false, execute: false } } });
    expect(screen.getByRole("button", { name: "New" })).toBeDisabled();
  });

  it("pins to its container: no h-screen root, min-h-0 panes, the rail list is the only rail scroll region", () => {
    const { container } = renderShell();
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveClass("h-screen");
    expect(root).toHaveClass("flex-1", "h-full", "min-h-0", "flex", "flex-col", "overflow-hidden", "bg-background");
    expect(screen.getByTestId("workbench-rail")).toHaveClass("shrink-0", "flex", "flex-col", "min-h-0");
    expect(screen.getByTestId("workbench-detail")).toHaveClass("min-h-0", "min-w-0");
    expect(screen.getByRole("listbox", { name: "Entities" })).toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-y-auto",
      "scroll-thin",
    );
    expect(screen.getByTestId("workbench-body")).toHaveClass("overflow-y-auto", "min-h-0");
  });

  it("keeps the footer and the + New block from shrinking out of view", () => {
    renderShell();
    expect(screen.getByText("Save bar").parentElement).toHaveClass("shrink-0");
    expect(screen.getByRole("button", { name: "New" }).parentElement).toHaveClass("shrink-0");
  });

  it("gives a tab-less body the same gutter as a tabbed one", () => {
    renderShell({ bare: true });
    expect(screen.getByTestId("workbench-body")).toHaveClass("px-6", "py-4");
  });

  it("renders the empty state when there are no items", () => {
    renderShell({ items: [] });
    expect(screen.getByTestId("workbench-empty")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("renders the page title, detail header, tab body and footer", () => {
    renderShell();
    expect(screen.getByRole("heading", { name: "Entities" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selected 1" })).toBeInTheDocument();
    expect(screen.getByText("Body of overview")).toBeInTheDocument();
    expect(screen.getByText("Save bar")).toBeInTheDocument();
  });

  it("never renders a modal dialog, even while guarding", async () => {
    renderShell({ dirty: true });
    await userEvent.click(screen.getByRole("option", { name: "Charlie" }));
    expect(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).toHaveLength(0);
  });

  it("renders header actions and, given a body override, hides the rail and detail", () => {
    renderShell({ headerActions: <span>Switcher</span>, bodyOverride: <span>Grid view</span> });
    expect(screen.getByText("Switcher")).toBeInTheDocument();
    expect(screen.getByText("Grid view")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByTestId("workbench-detail")).toBeNull();
  });

  it("renders children bare when the detail owns its own tabs", () => {
    renderShell({ bare: true });
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Body of overview")).toBeInTheDocument();
  });

  describe("generalized contract", () => {
    it("renders railHeader in place of the Active | Archived | All control", () => {
      renderShell({ railHeader: <div>Kind picker</div> });
      expect(screen.getByText("Kind picker")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Archived" })).toBeNull();
      expect(screen.queryByRole("button", { name: "All" })).toBeNull();
      // Search stays beside the header.
      expect(screen.getByRole("searchbox", { name: "Search Entities" })).toBeInTheDocument();
    });

    it("omits the filter control when filter props are not supplied", () => {
      renderShell({ noFilter: true });
      expect(screen.queryByRole("button", { name: "Archived" })).toBeNull();
      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("suppresses the New button, and never consults permissions, without onCreate", () => {
      // No provider at all: PermissionButton would throw on a missing query client.
      renderWithTooltips(
        <WorkbenchShell<Rec>
          title="Entities"
          railLabel="Entities"
          items={RECORDS}
          renderCard={(r) => <span>{r.name}</span>}
          selectedId={1}
          onSelect={() => {}}
          search=""
          onSearchChange={() => {}}
          dirty={false}
        />,
      );
      expect(screen.queryByRole("button", { name: "New" })).toBeNull();
      expect(screen.getByTestId("workbench-rail").querySelector(".border-t")).toBeNull();
    });

    it("keeps the legacy class contract when neither railHeader nor optional props are used (additive-only)", () => {
      const { container } = renderShell();
      const root = container.firstElementChild as HTMLElement;
      expect(root.className).toBe("flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-background");
      expect(screen.getByTestId("workbench-rail").className).toContain("shrink-0 flex flex-col min-h-0 bg-card");
      expect(screen.getByRole("listbox", { name: "Entities" }).className).toContain(
        "flex-1 min-h-0 overflow-y-auto scroll-thin p-2",
      );
      expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument();
    });
  });

  describe("collapsible rail", () => {
    const toggle = () => screen.getByRole("button", { name: /(hide|show) entities/i });

    it("renders PanelLeftClose when expanded and PanelLeftOpen when collapsed", async () => {
      renderShell();
      expect(toggle().querySelector("svg")).toHaveClass("lucide-panel-left-close");
      await userEvent.click(toggle());
      expect(toggle().querySelector("svg")).toHaveClass("lucide-panel-left-open");
    });

    it("flips aria-expanded, points aria-controls at the rail, and persists the choice", async () => {
      renderShell();
      const rail = screen.getByTestId("workbench-rail");
      expect(toggle()).toHaveAttribute("aria-controls", rail.id);
      expect(toggle()).toHaveAttribute("aria-expanded", "true");
      await userEvent.click(toggle());
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
      expect(toggle()).toHaveAttribute("aria-controls", rail.id);
      expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("true");
    });

    it("collapses to w-0 border-r-0 overflow-hidden and marks the rail inert", async () => {
      renderShell();
      const rail = screen.getByTestId("workbench-rail");
      expect(rail).toHaveClass("w-80");
      expect(rail).not.toHaveAttribute("inert");
      await userEvent.click(toggle());
      expect(rail).toHaveClass("w-0", "border-r-0", "overflow-hidden");
      expect(rail).not.toHaveClass("w-80");
      expect(rail).toHaveAttribute("inert");
      await userEvent.click(toggle());
      expect(rail).toHaveClass("w-80");
      expect(rail).not.toHaveAttribute("inert");
    });

    it("starts collapsed below 1280px with nothing stored, and expanded when the stored value says so", () => {
      stubMedia(1100);
      const view = renderShell();
      expect(screen.getByTestId("workbench-rail")).toHaveClass("w-0");
      view.unmount();
      localStorage.setItem(RAIL_COLLAPSED_KEY, "false");
      renderShell();
      expect(screen.getByTestId("workbench-rail")).toHaveClass("w-80");
    });

    it("toggles with Ctrl+B", async () => {
      renderShell();
      await userEvent.keyboard("{Control>}b{/Control}");
      expect(screen.getByTestId("workbench-rail")).toHaveClass("w-0");
    });

    it("animates the width unless the user prefers reduced motion", () => {
      const view = renderShell();
      expect(screen.getByTestId("workbench-rail").className).toMatch(/transition/);
      view.unmount();
      stubMedia(1600, true);
      renderShell();
      expect(screen.getByTestId("workbench-rail").className).not.toMatch(/transition/);
    });
  });

  describe("rail card hover and truncation tooltip", () => {
    // jsdom has no layout, so widths are stubbed on the element prototype.
    function stubWidths(scrollWidth: number, clientWidth: number) {
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
    }
    afterEach(() => vi.restoreAllMocks());

    function renderRail() {
      return renderWithTooltips(
        <Providers>
          <Harness />
        </Providers>,
      );
    }

    it("tints inactive cards on hover but never the selected one", () => {
      renderRail();
      const options = screen.getAllByRole("option");
      expect(options[1].className).toContain("hover:bg-muted");
      const selected = options.find((o) => o.getAttribute("aria-selected") === "true")!;
      expect(selected.className).not.toContain("hover:bg-muted");
      expect(selected.className).toContain("border-primary");
    });

    it("shows the card text in a tooltip on hover when the text is clipped", async () => {
      stubWidths(200, 100);
      renderRail();
      await userEvent.hover(screen.getByText("Bravo"));
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Bravo");
    });

    it("shows no tooltip when the text fits exactly", async () => {
      stubWidths(100, 100);
      renderRail();
      await userEvent.hover(screen.getByText("Bravo"));
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("opens on keyboard focus of a clipped card and closes on Escape or blur", async () => {
      stubWidths(200, 100);
      renderRail();
      const card = screen.getByText("Bravo");
      fireEvent.focus(card);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Bravo");
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("tooltip")).toBeNull();
      fireEvent.focus(card);
      expect(await screen.findByRole("tooltip")).toBeInTheDocument();
      fireEvent.blur(card);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });
});
