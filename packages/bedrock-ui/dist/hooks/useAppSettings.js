import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";
import { queryKeys } from "./queryKeys.js";
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
function coerce(setting, fallback) {
  if (!setting || setting.value === null || setting.value === void 0 || setting.value === "") {
    return fallback;
  }
  const raw = setting.value;
  switch (setting.value_type) {
    case "integer":
    case "float": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    }
    case "boolean":
      return /^(true|1|yes)$/i.test(raw);
    case "json":
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    default:
      return raw;
  }
}
async function fetchCategory(category) {
  const { data } = await apiClient.get(
    `${API_ROUTES.admin.config()}?category=${category}`
  );
  return data.data ?? [];
}
function useAppSettings() {
  const system = useQuery({
    queryKey: queryKeys.admin.config("system"),
    queryFn: () => fetchCategory("system"),
    staleTime: 5 * 6e4
  });
  const grid = useQuery({
    queryKey: queryKeys.admin.config("grid"),
    queryFn: () => fetchCategory("grid"),
    staleTime: 5 * 6e4
  });
  const logging = useQuery({
    queryKey: queryKeys.admin.config("logging"),
    queryFn: () => fetchCategory("logging"),
    staleTime: 5 * 6e4
  });
  const shortcuts = useQuery({
    queryKey: queryKeys.admin.config("shortcuts"),
    queryFn: () => fetchCategory("shortcuts"),
    staleTime: 5 * 6e4
  });
  return useMemo(() => {
    const byKey = (rows) => {
      const map = /* @__PURE__ */ new Map();
      (rows ?? []).forEach((r) => map.set(r.key, r));
      return map;
    };
    const sys = byKey(system.data);
    const g = byKey(grid.data);
    const l = byKey(logging.data);
    const s = byKey(shortcuts.data);
    return {
      system: {
        appName: coerce(sys.get(CONFIG_KEY.system.appName), appSettings.system.appName)
      },
      logging: {
        level: coerce(l.get(CONFIG_KEY.logging.level), appSettings.logging.level),
        disableConsoleInProd: coerce(
          l.get(CONFIG_KEY.logging.disableConsoleInProd),
          appSettings.logging.disableConsoleInProd
        ),
        redactKeys: coerce(
          l.get(CONFIG_KEY.logging.redactKeys),
          appSettings.logging.redactKeys
        )
      },
      grid: {
        tooltipDelayDuration: coerce(
          g.get(CONFIG_KEY.grid.tooltipDelayDuration),
          appSettings.grid.tooltipDelayDuration
        )
      },
      shortcuts: {
        enabled: coerce(s.get(CONFIG_KEY.shortcuts.enabled), appSettings.shortcuts.enabled),
        helpKey: coerce(s.get(CONFIG_KEY.shortcuts.helpKey), appSettings.shortcuts.helpKey),
        sequenceTimeoutMs: coerce(
          s.get(CONFIG_KEY.shortcuts.sequenceTimeoutMs),
          appSettings.shortcuts.sequenceTimeoutMs
        )
      }
    };
  }, [system.data, grid.data, logging.data, shortcuts.data]);
}
export {
  useAppSettings
};
//# sourceMappingURL=useAppSettings.js.map
