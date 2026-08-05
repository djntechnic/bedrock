/**
 * @file useAppSettings.ts
 * @module frontend/src/hooks/useAppSettings
 * @description DB-backed replacement for the env-var-driven appSettings object.
 *
 * Fetches the grid_/logging_/shortcuts_ categories from /api/v1/admin/config
 * and shapes them into the same nested surface consumers already rely on
 * (appSettings.grid.tooltipDelayDuration, appSettings.logging.redactKeys,
 * appSettings.shortcuts.enabled …). Env-var defaults from
 * frontend/src/config/index.ts remain as the boot-time fallback until the
 * first successful fetch resolves — this covers the pre-hydration render
 * window and the (rare) case where the admin endpoint is unreachable.
 *
 * Key convention: DB keys must be `<category>_<name>` snake_case per
 * api/core/config_constants.py; static enforcement lives in
 * scripts/maintenance/audit_config.py check C10.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { API_ROUTES } from "../api/routes";
import { apiClient, type ApiResponse } from "../api/client";
import { queryKeys } from "./queryKeys";
import type { ConfigSetting } from "./useAdminPlatform";
import { appSettings as bootDefaults } from "../config";

/** DB-backed keys read by this hook. Kept as literals so the audit script
 *  (audit_config.py C10) can grep them out and prove parity with the seed. */
const CONFIG_KEY = {
  system: {
    appName: "system_app_name",
  },
  grid: {
    tooltipDelayDuration: "grid_tooltip_delay_duration",
  },
  logging: {
    level: "logging_level",
    disableConsoleInProd: "logging_disable_console_in_prod",
    redactKeys: "logging_redact_keys",
  },
  shortcuts: {
    enabled: "shortcuts_enabled",
    helpKey: "shortcuts_help_key",
    sequenceTimeoutMs: "shortcuts_sequence_timeout_ms",
  },
} as const;

export interface ResolvedAppSettings {
  system: {
    appName: string;
  };
  logging: {
    level: string;
    disableConsoleInProd: boolean;
    redactKeys: string[];
  };
  grid: {
    tooltipDelayDuration: number;
  };
  shortcuts: {
    enabled: boolean;
    helpKey: string;
    sequenceTimeoutMs: number;
  };
}

function coerce(setting: ConfigSetting | undefined, fallback: unknown): unknown {
  if (!setting || setting.value === null || setting.value === undefined || setting.value === "") {
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

async function fetchCategory(category: string): Promise<ConfigSetting[]> {
  const { data } = await apiClient.get<ApiResponse<ConfigSetting[]>>(
    `${API_ROUTES.admin.config()}?category=${category}`,
  );
  return data.data ?? [];
}

/**
 * React Query hook that returns the merged appSettings surface. Boot-time
 * env-var defaults are returned until the first fetch resolves, so consumers
 * never see undefined during the pre-hydration render.
 */
export function useAppSettings(): ResolvedAppSettings {
  const system = useQuery({
    queryKey: queryKeys.admin.config("system"),
    queryFn: () => fetchCategory("system"),
    staleTime: 5 * 60_000,
  });
  const grid = useQuery({
    queryKey: queryKeys.admin.config("grid"),
    queryFn: () => fetchCategory("grid"),
    staleTime: 5 * 60_000,
  });
  const logging = useQuery({
    queryKey: queryKeys.admin.config("logging"),
    queryFn: () => fetchCategory("logging"),
    staleTime: 5 * 60_000,
  });
  const shortcuts = useQuery({
    queryKey: queryKeys.admin.config("shortcuts"),
    queryFn: () => fetchCategory("shortcuts"),
    staleTime: 5 * 60_000,
  });

  return useMemo<ResolvedAppSettings>(() => {
    const byKey = (rows: ConfigSetting[] | undefined) => {
      const map = new Map<string, ConfigSetting>();
      (rows ?? []).forEach((r) => map.set(r.key, r));
      return map;
    };
    const sys = byKey(system.data);
    const g = byKey(grid.data);
    const l = byKey(logging.data);
    const s = byKey(shortcuts.data);

    return {
      system: {
        appName: coerce(sys.get(CONFIG_KEY.system.appName), bootDefaults.system.appName) as string,
      },
      logging: {
        level: coerce(l.get(CONFIG_KEY.logging.level), bootDefaults.logging.level) as string,
        disableConsoleInProd: coerce(
          l.get(CONFIG_KEY.logging.disableConsoleInProd),
          bootDefaults.logging.disableConsoleInProd,
        ) as boolean,
        redactKeys: coerce(
          l.get(CONFIG_KEY.logging.redactKeys),
          bootDefaults.logging.redactKeys,
        ) as string[],
      },
      grid: {
        tooltipDelayDuration: coerce(
          g.get(CONFIG_KEY.grid.tooltipDelayDuration),
          bootDefaults.grid.tooltipDelayDuration,
        ) as number,
      },
      shortcuts: {
        enabled: coerce(s.get(CONFIG_KEY.shortcuts.enabled), bootDefaults.shortcuts.enabled) as boolean,
        helpKey: coerce(s.get(CONFIG_KEY.shortcuts.helpKey), bootDefaults.shortcuts.helpKey) as string,
        sequenceTimeoutMs: coerce(
          s.get(CONFIG_KEY.shortcuts.sequenceTimeoutMs),
          bootDefaults.shortcuts.sequenceTimeoutMs,
        ) as number,
      },
    };
  }, [system.data, grid.data, logging.data, shortcuts.data]);
}
