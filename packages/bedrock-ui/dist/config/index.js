const appSettings = {
  system: {
    // Human-readable application name shown in the sidebar, footer, and browser
    // tab. Authoritative value lives in app_config_settings.system_app_name and
    // is delivered via useAppSettings(); this literal is only the boot-time
    // fallback before the first admin/config fetch resolves. Env var
    // VITE_APP_NAME overrides for boot-critical rendering.
    appName: "bedrock"
  },
  logging: {
    // Falls back to safe parameters to guarantee layout efficiency
    level: "info",
    // Safeguards against client-side browser terminal pollution in production environments
    disableConsoleInProd: false,
    // Dynamic array filtering out credentials before strings map to the browser console
    redactKeys: ["password", "secretToken", "creditCard", "hashedPassword"]
  },
  grid: {
    // Centralized latency gate for all grid tooltip providers. Components must
    // read this (or the per-grid DB override surfaced by useGridConfig) rather
    // than hardcoding a delayDuration inline. Milliseconds.
    tooltipDelayDuration: Number(void 0) || 150
  },
  shortcuts: {
    // Master switch for the global keyboard shortcut manager. Disabling it stops
    // the window keydown observer from intercepting any hotkey and hides the
    // shortcuts reference sheet trigger. Read via resolveShortcutsConfig(); never
    // hardcode a boolean in a layout component.
    enabled: true,
    // Character that opens the keyboard shortcuts reference sheet. Configurable so
    // deployments can rebind the help key without editing layout files.
    helpKey: "?",
    // Maximum latency (ms) between the two keys of a chord sequence (e.g. "G D")
    // before the pending prefix is discarded. Never hardcoded in the observer.
    sequenceTimeoutMs: Number(void 0) || 1e3
  }
};
export {
  appSettings
};
//# sourceMappingURL=index.js.map
