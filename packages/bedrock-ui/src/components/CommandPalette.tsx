/**
 * @file CommandPalette.tsx
 * @module frontend/src/components
 * @description Global Cmd+K command palette. Surfaces static page/sub-view
 *              destinations (`commandRoutes.ts`) plus any registered entity
 *              search sources in one dialog, with recent/pinned static routes
 *              shown first when the query is empty. This is the app's
 *              <=2-action path to every route, including ones with no
 *              persistent-nav entry.
 *
 *              What an app searches is *not* known here: entity groups come
 *              from `searchSourceRegistry.ts`, and route groups from
 *              `commandRoutes.ts`. Both are registered by the application, and
 *              nothing in this file may assume what they contain.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pin, PinOff, Clock, ArrowRight } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./ui/command";
import { isNavItemVisible, type NavItem } from "./navRegistry";
import { useAuth } from "../hooks/useAuth";
import { useSecurity } from "../hooks/useSecurity";
import { getCommandRoutes, type CommandRouteItem } from "../lib/commandRoutes";
import { fuzzyFilter } from "../lib/fuzzyMatch";
import { useModules } from "../hooks/useModules";
import { useCommandPaletteStore } from "../store/commandPaletteStore";
import { logger } from "../lib/logger";
import {
  getSearchAllTarget,
  getSearchSources,
  type SearchSource,
  type SearchSourceResult,
} from "./searchSourceRegistry";

/** Result counts reported upward by each source group, so the palette can
 *  decide whether to show the empty state without calling the sources'
 *  hooks itself. */
type SourceStatus = { count: number; isFetching: boolean };

/**
 * Renders one registered source's results.
 *
 * A source's `useResults` is a hook, and this wrapper is what makes that
 * safe: each source gets its own component instance, so its hooks are
 * isolated from every other source's and from the palette's own.
 */
function SearchSourceGroup({
  source,
  query,
  enabled,
  onStatus,
  onSelect,
}: {
  source: SearchSource;
  query: string;
  enabled: boolean;
  onStatus: (id: string, status: SourceStatus) => void;
  onSelect: (source: SearchSource, result: SearchSourceResult) => void;
}) {
  const { results, isFetching = false } = source.useResults(query, enabled);

  useEffect(() => {
    onStatus(source.id, { count: results.length, isFetching });
  }, [source.id, results.length, isFetching, onStatus]);

  if (results.length === 0 && !isFetching) return null;

  return (
    <CommandGroup heading={source.heading}>
      {isFetching && results.length === 0 && (
        <div className="px-2 py-2.5 text-xs text-muted-foreground">Searching…</div>
      )}
      {results.map((result) => (
        <CommandItem
          key={result.id}
          value={String(result.id)}
          onSelect={() => onSelect(source, result)}
        >
          {result.icon}
          <span className="flex-1 truncate">{result.label}</span>
          {result.hint}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/**
 * Rendering order for the static-route groups: first appearance in the
 * registered route list.
 *
 * This was a hardcoded array of MLBTracker's group names — "Leaderboards",
 * "Rankings", "Trends", "Inventory". A second application's groups would have
 * matched none of them, and its entire static-route section would have
 * rendered empty while every route was registered and findable. Registration
 * order is what `commandRoutes.ts` already documents, and it is stable across
 * restarts because the app registers in a fixed order.
 */
export function groupOrder(items: CommandRouteItem[]): CommandRouteItem["group"][] {
  const seen: CommandRouteItem["group"][] = [];
  for (const item of items) {
    if (!seen.includes(item.group)) seen.push(item.group);
  }
  return seen;
}

function groupRoutes(items: CommandRouteItem[]): Map<CommandRouteItem["group"], CommandRouteItem[]> {
  const map = new Map<CommandRouteItem["group"], CommandRouteItem[]>();
  for (const item of items) {
    const list = map.get(item.group);
    if (list) list.push(item);
    else map.set(item.group, [item]);
  }
  return map;
}

export interface CommandPaletteProps {
  /**
   * Prompt text, matching whatever the app's `GlobalSearchBar` shows. Same
   * reasoning as that prop: the default names nothing this package does not
   * have.
   */
  placeholder?: string;
}

export default function CommandPalette({
  placeholder = "Search pages and records…",
}: CommandPaletteProps = {}) {
  const navigate = useNavigate();
  const { hasModule } = useModules();
  const { user, isAdmin, hasRole } = useAuth();
  const security = useSecurity();

  // Snapshotted on first render: registration is import-time, and freezing the
  // list guarantees the source components keep a stable order for their hooks.
  const [allSources] = useState(getSearchSources);
  const [allTarget] = useState(getSearchAllTarget);
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>({});
  const handleStatus = useCallback((id: string, status: SourceStatus) => {
    setSourceStatus((prev) => {
      const cur = prev[id];
      if (cur && cur.count === status.count && cur.isFetching === status.isFetching) {
        return prev;
      }
      return { ...prev, [id]: status };
    });
  }, []);

  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const recentIds = useCommandPaletteStore((s) => s.recentIds);
  const pinnedIds = useCommandPaletteStore((s) => s.pinnedIds);
  const addRecent = useCommandPaletteStore((s) => s.addRecent);
  const togglePinned = useCommandPaletteStore((s) => s.togglePinned);

  const [query, setQuery] = useState("");

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const visibleRoutes = useMemo(
    () => getCommandRoutes().filter((r) => {
      if (r.module && !hasModule(r.module)) return false;
      return isNavItemVisible(r as unknown as NavItem, { user, isAdmin, hasRole }, security);
    }),
    [hasModule, user, isAdmin, hasRole, security]
  );
  const visibleById = useMemo(
    () => new Map(visibleRoutes.map((r) => [r.id, r] as const)),
    [visibleRoutes]
  );

  const routeMatches = useMemo(
    () =>
      fuzzyFilter(visibleRoutes, query, (r) => `${r.label} ${(r.keywords ?? []).join(" ")}`),
    [visibleRoutes, query]
  );
  const groupedMatches = useMemo(() => groupRoutes(routeMatches), [routeMatches]);
  // Ordered from the full visible set, not from the current matches, so the
  // section order does not reshuffle as the user types.
  const orderedGroups = useMemo(() => groupOrder(visibleRoutes), [visibleRoutes]);

  const pinnedItems = useMemo(
    () => pinnedIds.map((id) => visibleById.get(id)).filter((r): r is CommandRouteItem => !!r),
    [pinnedIds, visibleById]
  );
  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => visibleById.get(id))
        .filter((r): r is CommandRouteItem => !!r && !pinnedIds.includes(r.id)),
    [recentIds, pinnedIds, visibleById]
  );

  const visibleSources = useMemo(
    () => allSources.filter((s) => !s.module || hasModule(s.module)),
    [allSources, hasModule]
  );

  const showingSearch = query.trim().length > 0;
  const sourceResultCount = visibleSources.reduce(
    (n, s) => n + (sourceStatus[s.id]?.count ?? 0),
    0
  );
  const anySourceFetching = visibleSources.some((s) => sourceStatus[s.id]?.isFetching);
  const hasAnyResults = routeMatches.length > 0 || sourceResultCount > 0;

  function runRoute(item: CommandRouteItem) {
    addRecent(item.id);
    logger.info("CommandPalette: navigated", { to: item.to, source: "route", id: item.id });
    navigate(item.to);
    setOpen(false);
  }

  const runSourceResult = useCallback(
    (source: SearchSource, result: SearchSourceResult) => {
      logger.info("CommandPalette: navigated", {
        to: result.to,
        source: source.id,
        id: String(result.id),
      });
      navigate(result.to);
      setOpen(false);
    },
    [navigate, setOpen]
  );

  function runSeeAllResults() {
    const q = query.trim();
    if (!q || !allTarget) return;
    const to = allTarget.to(q);
    logger.info("CommandPalette: navigated", { to, source: "see-all", query: q });
    navigate(to);
    setOpen(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Jump to any page, record, or admin grid"
    >
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasAnyResults && !anySourceFetching && <CommandEmpty>No results found.</CommandEmpty>}

        {!showingSearch && pinnedItems.length > 0 && (
          <CommandGroup heading="Pinned">
            {pinnedItems.map((item) => (
              <CommandItem key={item.id} value={item.id} onSelect={() => runRoute(item)}>
                <item.icon />
                <span className="flex-1 truncate">{item.label}</span>
                <button
                  type="button"
                  aria-label={`Unpin ${item.label}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinned(item.id);
                  }}
                >
                  <PinOff className="h-3.5 w-3.5" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!showingSearch && recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.map((item) => (
              <CommandItem key={item.id} value={item.id} onSelect={() => runRoute(item)}>
                <Clock />
                <span className="flex-1 truncate">{item.label}</span>
                <button
                  type="button"
                  aria-label={`Pin ${item.label}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinned(item.id);
                  }}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {orderedGroups.map((group) => {
          const items = groupedMatches.get(group);
          if (!items || items.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => {
                const pinned = pinnedIds.includes(item.id);
                return (
                  <CommandItem key={item.id} value={item.id} onSelect={() => runRoute(item)}>
                    <item.icon />
                    <span className="flex-1 truncate">{item.label}</span>
                    <button
                      type="button"
                      aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinned(item.id);
                      }}
                    >
                      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        {visibleSources.map((source) => (
          <SearchSourceGroup
            key={source.id}
            source={source}
            query={query}
            enabled={open}
            onStatus={handleStatus}
            onSelect={runSourceResult}
          />
        ))}

        {showingSearch && allTarget && (!allTarget.module || hasModule(allTarget.module)) && (
          <CommandGroup heading="Search">
            <CommandItem value="see-all-results" onSelect={runSeeAllResults}>
              <ArrowRight />
              <span>
                See all results for &ldquo;<span className="font-medium text-foreground">{query.trim()}</span>&rdquo;
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
