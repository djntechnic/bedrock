import { useMemo } from "react";
import { useAppConfigContext } from "../context/AppConfigContext.js";
import { appSettings } from "../config/index.js";
const CONFIG_KEY = {
  system: {
    appName: "system_app_name"
  },
  grid: {
    tooltipDelayDuration: "grid_tooltip_delay_duration"
  },
  logging: {
    level: "logging_level",
    disableConsoleInProd: "logging_disable_console_in_prod",
    redactKeys: "logging_redact_keys"
  },
  shortcuts: {
    enabled: "shortcuts_enabled",
    helpKey: "shortcuts_help_key",
    sequenceTimeoutMs: "shortcuts_sequence_timeout_ms"
  }
};
function coerceValue(raw, fallback) {
  if (raw === null || raw === void 0 || raw === "") {
    return fallback;
  }
  if (typeof fallback === "boolean") {
    return /^(true|1|yes)$/i.test(raw);
  }
  if (typeof fallback === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  if (Array.isArray(fallback)) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return raw;
}
function useAppSettings() {
  const appConfig = useAppConfigContext();
  return useMemo(() => {
    const map = appConfig?.app_config ?? {};
    return {
      system: {
        appName: coerceValue(map[CONFIG_KEY.system.appName], appSettings.system.appName)
      },
      logging: {
        level: coerceValue(map[CONFIG_KEY.logging.level], appSettings.logging.level),
        disableConsoleInProd: coerceValue(
          map[CONFIG_KEY.logging.disableConsoleInProd],
          appSettings.logging.disableConsoleInProd
        ),
        redactKeys: coerceValue(
          map[CONFIG_KEY.logging.redactKeys],
          appSettings.logging.redactKeys
        )
      },
      grid: {
        tooltipDelayDuration: coerceValue(
          map[CONFIG_KEY.grid.tooltipDelayDuration],
          appSettings.grid.tooltipDelayDuration
        )
      },
      shortcuts: {
        enabled: coerceValue(map[CONFIG_KEY.shortcuts.enabled], appSettings.shortcuts.enabled),
        helpKey: coerceValue(map[CONFIG_KEY.shortcuts.helpKey], appSettings.shortcuts.helpKey),
        sequenceTimeoutMs: coerceValue(
          map[CONFIG_KEY.shortcuts.sequenceTimeoutMs],
          appSettings.shortcuts.sequenceTimeoutMs
        )
      }
    };
  }, [appConfig]);
}
export {
  useAppSettings
};
//# sourceMappingURL=useAppSettings.js.map
