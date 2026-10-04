/**
 * @file WorkbenchShell.tsx
 * @module @djntechnic/bedrock-ui/components/WorkbenchShell
 * @description The rail-and-detail layout every workbench page composes
 * (spec §4.4): a filterable, searchable, keyboard-driven record rail on the
 * left, a tabbed detail pane on the right, and an inline dirty guard between
 * them. It is layout only — every piece of domain state arrives as a prop and
 * leaves as a callback; the shell owns nothing but which card the keyboard is
 * on and which navigation is waiting behind the guard.
 *
 * The guard is inline, never a modal: a pending navigation parks behind a
 * "Discard unsaved changes?" group in the detail pane until the operator
 * keeps editing or discards.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { PermissionButton, type ActionType } from "../../hooks/useSecurity";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { Button, buttonVariants } from "../ui/button";
import { Input } from "../ui/input";
import { SegmentedControl } from "../ui/segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useWorkbenchRail } from "./useWorkbenchRail";

export type WorkbenchFilter = "active" | "archived" | "all";

const FILTER_OPTIONS: { value: WorkbenchFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

/** True when the element, or any descendant, is clipped horizontally. */
function isOverflowing(root: HTMLElement): boolean {
  if (root.scrollWidth > root.clientWidth) return true;
  return Array.from(root.querySelectorAll<HTMLElement>("*")).some((el) => el.scrollWidth > el.clientWidth);
}

/** Shows the full card text in a tooltip, but only when something in the card is truncated. */
function RailCardTip({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const openIfClipped = () => {
    const root = rootRef.current;
    if (!root || !isOverflowing(root)) return;
    setText((root.textContent ?? "").trim());
    setOpen(true);
  };

  return (
    // Self-provided so every workbench page and test mounts the rail without wiring one.
    <TooltipProvider>
    <Tooltip open={open} onOpenChange={(next) => !next && setOpen(false)}>
      <TooltipTrigger asChild>
        <div
          ref={rootRef}
          onPointerEnter={openIfClipped}
          onPointerLeave={() => setOpen(false)}
          onFocus={openIfClipped}
          onBlur={() => setOpen(false)}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{text}</TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}

export interface WorkbenchShellProps<T extends { id: string | number }> {
  /** Page heading. */
  title: string;
  /** Names the rail list and its search box ("Search {railLabel}"). */
  railLabel: string;
  items: T[];
  renderCard: (item: T) => ReactNode;
  selectedId: T["id"] | null;
  onSelect: (id: T["id"]) => void;
  /** With `onFilterChange`, drives the Active | Archived | All control. Omit both to hide it. */
  filter?: WorkbenchFilter;
  onFilterChange?: (filter: WorkbenchFilter) => void;
  /** Replaces the Active | Archived | All control above the search box. */
  railHeader?: ReactNode;
  /** Controlled and debounce-free: every keystroke is reported. */
  search: string;
  onSearchChange: (search: string) => void;
  /** Omit to suppress the "New" button (and its permission lookup). */
  onCreate?: () => void;
  /** Required for the "New" button to render; ignored without `onCreate`. */
  createPermission?: { module: string; action: ActionType };
  /** When set, create is disabled and this is its tooltip and description. */
  createDisabledReason?: string;
  /** Omit when the detail owns its own tabs; the shell then renders `children` bare. */
  tabs?: { value: string; label: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** The detail has unsaved edits; navigation waits behind the guard. */
  dirty: boolean;
  /** Called when the operator discards, before the parked navigation runs. */
  onDiscard?: () => void;
  detailHeader?: ReactNode;
  footer?: ReactNode;
  /** Page-level controls beside the heading, such as a view switcher. */
  headerActions?: ReactNode;
  /** Replaces the rail and detail entirely (a table view) while the header stays. */
  bodyOverride?: ReactNode;
  children?: ReactNode;
}

export default function WorkbenchShell<T extends { id: string | number }>({
  title,
  railLabel,
  items,
  renderCard,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  railHeader,
  search,
  onSearchChange,
  onCreate,
  createPermission,
  createDisabledReason,
  tabs,
  activeTab,
  onTabChange,
  dirty,
  onDiscard,
  detailHeader,
  footer,
  headerActions,
  bodyOverride,
  children,
}: WorkbenchShellProps<T>) {
  const baseId = useId();
  const guardLabelId = `${baseId}-guard`;
  const createReasonId = `${baseId}-create-reason`;
  const railId = `${baseId}-rail`;
  const optionId = (id: T["id"]) => `${baseId}-option-${id}`;
  const rail = useWorkbenchRail();
  const RailIcon = rail.collapsed ? PanelLeftOpen : PanelLeftClose;

  const [pending, setPending] = useState<(() => void) | null>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Where focus goes back to when the operator keeps editing. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Tracked by id, not index, so a search or an external selection change can
  // never leave the keyboard highlight on the wrong card.
  const [activeId, setActiveId] = useState<T["id"] | null>(selectedId);
  useEffect(() => setActiveId(selectedId), [selectedId]);
  const activeFound = items.findIndex((item) => item.id === activeId);
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const activeIndex = activeFound >= 0 ? activeFound : Math.max(selectedIndex, 0);
  const activeItem = items[activeIndex];

  useEffect(() => {
    if (activeItem) document.getElementById(optionId(activeItem.id))?.scrollIntoView({ block: "nearest" });
    // optionId closes over a stable useId base, so the active id is the only input.
  }, [activeItem?.id]);

  useEffect(() => {
    if (pending) keepEditingRef.current?.focus();
  }, [pending]);

  // A save elsewhere cleared the dirty state: the parked navigation is moot.
  useEffect(() => {
    if (!dirty) setPending(null);
  }, [dirty]);

  /** Runs a navigation now, or parks it behind the guard when the detail is dirty. */
  const guard = (action: () => void) => {
    if (dirty) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending(() => action);
    } else action();
  };

  const keepEditing = () => {
    setPending(null);
    (returnFocusRef.current ?? listRef.current)?.focus();
  };

  const discard = () => {
    const action = pending;
    setPending(null);
    onDiscard?.();
    action?.();
  };

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    setActiveId(item.id);
    if (item.id !== selectedId) guard(() => onSelect(item.id));
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, items.length - 1),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveId(items[moves[event.key]].id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(activeIndex);
    }
  };

  const guardGroup = pending && (

              <div
                role="group"
                aria-labelledby={guardLabelId}
                onKeyDown={(event) => {
                  if (event.key === "Escape") keepEditing();
                }}
                className="shrink-0 mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-warning bg-warning/10 px-4 py-2"
              >
                <p id={guardLabelId} className="text-sm font-medium text-foreground">
                  Discard unsaved changes?
                </p>
                <div className="flex gap-2">
                  <Button ref={keepEditingRef} variant="outline" size="sm" onClick={keepEditing}>
                    Keep editing
                  </Button>
                  <Button variant="destructive" size="sm" onClick={discard}>
                    Discard
                  </Button>
                </div>
              </div>
  );

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-background">
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-4">
        <div className="flex items-center gap-2">
          {!bodyOverride && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${rail.collapsed ? "Show" : "Hide"} ${railLabel}`}
              aria-expanded={!rail.collapsed}
              aria-controls={railId}
              onClick={rail.toggle}
            >
              <RailIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
          <PageHeader title={title} />
        </div>
        {headerActions}
      </div>

      {bodyOverride ? (
        <div data-testid="workbench-override" className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {bodyOverride}
        </div>
      ) : (
      <div className="flex-1 min-h-0 flex">
        <aside
          id={railId}
          data-testid="workbench-rail"
          // React 18 has no `inert` prop; the attribute is set directly.
          {...(rail.collapsed ? ({ inert: "" } as Record<string, string>) : {})}
          className={cn(
            "shrink-0 flex flex-col min-h-0 bg-card",
            rail.collapsed ? "w-0 border-r-0 overflow-hidden" : "w-80 border-r border-border",
            rail.animate && "transition-[width] duration-200",
          )}
        >
          <div className="shrink-0 flex flex-col gap-2 p-3 border-b border-border">
            {railHeader ??
              (filter !== undefined && onFilterChange && (
                <SegmentedControl
                  options={FILTER_OPTIONS}
                  value={filter}
                  onChange={(next) => {
                    if (next !== filter) guard(() => onFilterChange(next));
                  }}
                  size="sm"
                />
              ))}
            <Input
              type="search"
              aria-label={`Search ${railLabel}`}
              placeholder={`Search ${railLabel.toLowerCase()}`}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>

          {items.length === 0 ? (
            <div data-testid="workbench-empty" className="flex-1 min-h-0">
              <EmptyState
                title={`No ${railLabel.toLowerCase()}`}
                description={search ? "Nothing matches this search." : undefined}
              />
            </div>
          ) : (
            <div
              ref={listRef}
              role="listbox"
              aria-label={railLabel}
              aria-activedescendant={activeItem ? optionId(activeItem.id) : undefined}
              tabIndex={0}
              onKeyDown={onListKeyDown}
              className="flex-1 min-h-0 overflow-y-auto scroll-thin p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              {items.map((item, index) => {
                const isSelected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    id={optionId(item.id)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(index)}
                    className={cn(
                      "cursor-pointer rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-foreground",
                      !isSelected && "hover:bg-accent/50",
                      index === activeIndex && "bg-muted",
                      isSelected && "border-primary bg-secondary text-foreground-strong font-medium",
                    )}
                  >
                    <RailCardTip>{renderCard(item)}</RailCardTip>
                  </div>
                );
              })}
            </div>
          )}

          {onCreate && createPermission && (
            <div className="shrink-0 p-3 border-t border-border">
              <PermissionButton
                module={createPermission.module}
                action={createPermission.action}
                disabled={Boolean(createDisabledReason)}
                title={createDisabledReason}
                tooltipWhenDisabled={createDisabledReason ?? "You do not have permission to create here"}
                aria-describedby={createDisabledReason ? createReasonId : undefined}
                onClick={() => guard(onCreate)}
                className={cn(buttonVariants({ size: "sm" }), "w-full")}
              >
                <Plus className="size-4" aria-hidden="true" />
                New
              </PermissionButton>
              {createDisabledReason && (
                <span id={createReasonId} className="sr-only">
                  {createDisabledReason}
                </span>
              )}
            </div>
          )}
        </aside>

        <section data-testid="workbench-detail" className="flex-1 min-h-0 min-w-0 flex flex-col">
          {tabs ? (
            <Tabs
              value={activeTab}
              onValueChange={(next) => {
                if (next !== activeTab) guard(() => onTabChange?.(next));
              }}
              className="flex-1 min-h-0 flex flex-col gap-0"
            >
              <div className="shrink-0 flex flex-col gap-3 border-b border-border bg-background px-6 pt-4 pb-2">
                {detailHeader}
                <TabsList>
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {guardGroup}

              <TabsContent
                value={activeTab ?? ""}
                data-testid="workbench-body"
                className="flex-1 min-h-0 overflow-y-auto scroll-thin px-6 py-4 mt-0"
              >
                {children}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {detailHeader && (
                <div className="shrink-0 border-b border-border bg-background px-6 pt-4 pb-2">{detailHeader}</div>
              )}
              {guardGroup}
              <div data-testid="workbench-body" className="flex-1 min-h-0 flex flex-col px-6 py-4">
                {children}
              </div>
            </>
          )}

          {footer && <div className="shrink-0 border-t border-border bg-card px-6 py-3">{footer}</div>}
        </section>
      </div>
      )}
    </div>
  );
}
