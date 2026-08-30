import { DEFAULT_SHORTCUTS_CONFIG } from "../types/grid.js";
function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
}
function primaryModifierLabel() {
  return isMacPlatform() ? "Cmd" : "Ctrl";
}
function resolveShortcutsConfig(overrides) {
  return { ...DEFAULT_SHORTCUTS_CONFIG, ...overrides ?? {} };
}
function buildShortcutGroups(config = DEFAULT_SHORTCUTS_CONFIG) {
  const mod = primaryModifierLabel();
  return [
    {
      id: "navigation",
      title: "Navigation",
      bindings: [
        { id: "search", label: "Global Search", keys: [[mod, "K"]] },
        { id: "goto-dashboard", label: "Dashboard", keys: [["G", "D"]] },
        { id: "goto-leaderboards", label: "Leaderboards", keys: [["G", "L"]] },
        { id: "goto-rankings", label: "Rankings", keys: [["G", "R"]] },
        { id: "goto-trends", label: "Trends", keys: [["G", "T"]] },
        { id: "goto-players", label: "Players", keys: [["G", "P"]] }
      ]
    },
    {
      id: "table-controls",
      title: "Table Controls",
      bindings: [
        { id: "row-nav", label: "Row Navigation", keys: [["↑"], ["↓"]] },
        { id: "row-exec", label: "Row Execution", keys: [["Enter"]] },
        { id: "close-panel", label: "Close Panel", keys: [["Esc"]] }
      ]
    },
    {
      id: "appearance",
      title: "Appearance System",
      bindings: [
        { id: "theme-toggle", label: "Theme Mutation", keys: [[mod, "Shift", "L"]] }
      ]
    },
    {
      id: "general",
      title: "General Utility",
      bindings: [
        { id: "help", label: "Help Matrix", keys: [[config.helpKey]] }
      ]
    }
  ];
}
export {
  buildShortcutGroups,
  isMacPlatform,
  primaryModifierLabel,
  resolveShortcutsConfig
};
//# sourceMappingURL=shortcuts.js.map
