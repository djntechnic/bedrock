import { appSettings } from "../config/index.js";
const DEFAULT_GRID_HEADER_CONFIG = {
  tooltipDelayDuration: appSettings.grid.tooltipDelayDuration,
  showSearch: false,
  showDensityToggle: true,
  showColumnToggle: true,
  showExportCsv: true,
  showRankHighlight: false
};
const DEFAULT_TOOLTIP_DELAY = appSettings.grid.tooltipDelayDuration;
const DEFAULT_SHORTCUTS_CONFIG = {
  shortcutsEnabled: appSettings.shortcuts.enabled,
  helpKey: appSettings.shortcuts.helpKey,
  sequenceTimeoutMs: appSettings.shortcuts.sequenceTimeoutMs,
  tooltipDelayDuration: appSettings.grid.tooltipDelayDuration
};
export {
  DEFAULT_GRID_HEADER_CONFIG,
  DEFAULT_SHORTCUTS_CONFIG,
  DEFAULT_TOOLTIP_DELAY
};
//# sourceMappingURL=grid.js.map
