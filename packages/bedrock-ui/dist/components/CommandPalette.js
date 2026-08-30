import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PinOff, Clock, Pin, ArrowRight } from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./ui/command.js";
import { getCommandRoutes } from "../lib/commandRoutes.js";
import { fuzzyFilter } from "../lib/fuzzyMatch.js";
import { useModules } from "../hooks/useModules.js";
import { useSecurity } from "../hooks/useSecurity.js";
import { useCommandPaletteStore } from "../store/commandPaletteStore.js";
import { logger } from "../lib/logger.js";
import { getSearchSources, getSearchAllTarget } from "./searchSourceRegistry.js";
function SearchSourceGroup({
  source,
  query,
  enabled,
  onStatus,
  onSelect
}) {
  const { results, isFetching = false } = source.useResults(query, enabled);
  useEffect(() => {
    onStatus(source.id, { count: results.length, isFetching });
  }, [source.id, results.length, isFetching, onStatus]);
  if (results.length === 0 && !isFetching) return null;
  return /* @__PURE__ */ jsxs(CommandGroup, { heading: source.heading, children: [
    isFetching && results.length === 0 && /* @__PURE__ */ jsx("div", { className: "px-2 py-2.5 text-xs text-muted-foreground", children: "Searching…" }),
    results.map((result) => /* @__PURE__ */ jsxs(
      CommandItem,
      {
        value: String(result.id),
        onSelect: () => onSelect(source, result),
        children: [
          result.icon,
          /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: result.label }),
          result.hint
        ]
      },
      result.id
    ))
  ] });
}
function groupOrder(items) {
  const seen = [];
  for (const item of items) {
    if (!seen.includes(item.group)) seen.push(item.group);
  }
  return seen;
}
function groupRoutes(items) {
  const map = /* @__PURE__ */ new Map();
  for (const item of items) {
    const list = map.get(item.group);
    if (list) list.push(item);
    else map.set(item.group, [item]);
  }
  return map;
}
function CommandPalette({
  placeholder = "Search pages and records…"
} = {}) {
  const navigate = useNavigate();
  const { hasModule } = useModules();
  const { can } = useSecurity();
  const [allSources] = useState(getSearchSources);
  const [allTarget] = useState(getSearchAllTarget);
  const [sourceStatus, setSourceStatus] = useState({});
  const handleStatus = useCallback((id, status) => {
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
    function handler(e) {
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
      if (r.module && r.action && !can(r.module, r.action)) return false;
      return true;
    }),
    [hasModule, can]
  );
  const visibleById = useMemo(
    () => new Map(visibleRoutes.map((r) => [r.id, r])),
    [visibleRoutes]
  );
  const routeMatches = useMemo(
    () => fuzzyFilter(visibleRoutes, query, (r) => `${r.label} ${(r.keywords ?? []).join(" ")}`),
    [visibleRoutes, query]
  );
  const groupedMatches = useMemo(() => groupRoutes(routeMatches), [routeMatches]);
  const orderedGroups = useMemo(() => groupOrder(visibleRoutes), [visibleRoutes]);
  const pinnedItems = useMemo(
    () => pinnedIds.map((id) => visibleById.get(id)).filter((r) => !!r),
    [pinnedIds, visibleById]
  );
  const recentItems = useMemo(
    () => recentIds.map((id) => visibleById.get(id)).filter((r) => !!r && !pinnedIds.includes(r.id)),
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
  function runRoute(item) {
    addRecent(item.id);
    logger.info("CommandPalette: navigated", { to: item.to, source: "route", id: item.id });
    navigate(item.to);
    setOpen(false);
  }
  const runSourceResult = useCallback(
    (source, result) => {
      logger.info("CommandPalette: navigated", {
        to: result.to,
        source: source.id,
        id: String(result.id)
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
  return /* @__PURE__ */ jsxs(
    CommandDialog,
    {
      open,
      onOpenChange: setOpen,
      title: "Command Palette",
      description: "Jump to any page, record, or admin grid",
      children: [
        /* @__PURE__ */ jsx(
          CommandInput,
          {
            placeholder,
            value: query,
            onValueChange: setQuery
          }
        ),
        /* @__PURE__ */ jsxs(CommandList, { children: [
          !hasAnyResults && !anySourceFetching && /* @__PURE__ */ jsx(CommandEmpty, { children: "No results found." }),
          !showingSearch && pinnedItems.length > 0 && /* @__PURE__ */ jsx(CommandGroup, { heading: "Pinned", children: pinnedItems.map((item) => /* @__PURE__ */ jsxs(CommandItem, { value: item.id, onSelect: () => runRoute(item), children: [
            /* @__PURE__ */ jsx(item.icon, {}),
            /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: item.label }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                "aria-label": `Unpin ${item.label}`,
                className: "text-muted-foreground hover:text-foreground",
                onClick: (e) => {
                  e.stopPropagation();
                  togglePinned(item.id);
                },
                children: /* @__PURE__ */ jsx(PinOff, { className: "h-3.5 w-3.5" })
              }
            )
          ] }, item.id)) }),
          !showingSearch && recentItems.length > 0 && /* @__PURE__ */ jsx(CommandGroup, { heading: "Recent", children: recentItems.map((item) => /* @__PURE__ */ jsxs(CommandItem, { value: item.id, onSelect: () => runRoute(item), children: [
            /* @__PURE__ */ jsx(Clock, {}),
            /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: item.label }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                "aria-label": `Pin ${item.label}`,
                className: "text-muted-foreground hover:text-foreground",
                onClick: (e) => {
                  e.stopPropagation();
                  togglePinned(item.id);
                },
                children: /* @__PURE__ */ jsx(Pin, { className: "h-3.5 w-3.5" })
              }
            )
          ] }, item.id)) }),
          orderedGroups.map((group) => {
            const items = groupedMatches.get(group);
            if (!items || items.length === 0) return null;
            return /* @__PURE__ */ jsx(CommandGroup, { heading: group, children: items.map((item) => {
              const pinned = pinnedIds.includes(item.id);
              return /* @__PURE__ */ jsxs(CommandItem, { value: item.id, onSelect: () => runRoute(item), children: [
                /* @__PURE__ */ jsx(item.icon, {}),
                /* @__PURE__ */ jsx("span", { className: "flex-1 truncate", children: item.label }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    "aria-label": pinned ? `Unpin ${item.label}` : `Pin ${item.label}`,
                    className: "text-muted-foreground hover:text-foreground",
                    onClick: (e) => {
                      e.stopPropagation();
                      togglePinned(item.id);
                    },
                    children: pinned ? /* @__PURE__ */ jsx(PinOff, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ jsx(Pin, { className: "h-3.5 w-3.5" })
                  }
                )
              ] }, item.id);
            }) }, group);
          }),
          visibleSources.map((source) => /* @__PURE__ */ jsx(
            SearchSourceGroup,
            {
              source,
              query,
              enabled: open,
              onStatus: handleStatus,
              onSelect: runSourceResult
            },
            source.id
          )),
          showingSearch && allTarget && (!allTarget.module || hasModule(allTarget.module)) && /* @__PURE__ */ jsx(CommandGroup, { heading: "Search", children: /* @__PURE__ */ jsxs(CommandItem, { value: "see-all-results", onSelect: runSeeAllResults, children: [
            /* @__PURE__ */ jsx(ArrowRight, {}),
            /* @__PURE__ */ jsxs("span", { children: [
              "See all results for “",
              /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground", children: query.trim() }),
              "”"
            ] })
          ] }) })
        ] })
      ]
    }
  );
}
export {
  CommandPalette as default,
  groupOrder
};
//# sourceMappingURL=CommandPalette.js.map
