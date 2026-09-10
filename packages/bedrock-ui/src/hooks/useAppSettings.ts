/**
 * @file useAppSettings.ts
 * @module frontend/src/hooks/useAppSettings
 * @description DB-backed replacement for the env-var-driven appSettings object.
 *
 * Consumes appConfig from AppConfigContext (populated once on mount from
 * /api/v1/config/app) to eliminate startup 401 noise. Shapes settings into the
 * same nested surface consumers already rely on (appSettings.grid.tooltipDelayDuration,
 * appSettings.logging.redactKeys, appSettings.shortcuts.enabled …).
 *
 * Env-var defaults from frontend/src/config/index.ts remain as the boot-time
 * fallback until the context resolves — this covers the pre-hydration render
 * window.
 *
 * Key convention: DB keys must be `<category>_<name>` snake_case per
 * api/core/config_constants.py; static enforcement lives in
 * scripts/maintenance/audit_config.py check C10.
 */
import { useMemo } from "react";
import { useAppConfigContext } from "../context/AppConfigContext";
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

function coerceValue(raw: string | undefined, fallback: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") {
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

/**
 * React hook that returns the merged appSettings surface. Boot-time
 * env-var defaults are returned until AppConfigContext resolves, so consumers
 * never see undefined during the pre-hydration render.
 */
export function useAppSettings(): ResolvedAppSettings {
  const appConfig = useAppConfigContext();

  return useMemo<ResolvedAppSettings>(() => {
    const map = appConfig?.app_config ?? {};

    return {
      system: {
        appName: coerceValue(map[CONFIG_KEY.system.appName], bootDefaults.system.appName) as string,
      },
      logging: {
        level: coerceValue(map[CONFIG_KEY.logging.level], bootDefaults.logging.level) as string,
        disableConsoleInProd: coerceValue(
          map[CONFIG_KEY.logging.disableConsoleInProd],
          bootDefaults.logging.disableConsoleInProd,
        ) as boolean,
        redactKeys: coerceValue(
          map[CONFIG_KEY.logging.redactKeys],
          bootDefaults.logging.redactKeys,
        ) as string[],
      },
      grid: {
        tooltipDelayDuration: coerceValue(
          map[CONFIG_KEY.grid.tooltipDelayDuration],
          bootDefaults.grid.tooltipDelayDuration,
        ) as number,
      },
      shortcuts: {
        enabled: coerceValue(map[CONFIG_KEY.shortcuts.enabled], bootDefaults.shortcuts.enabled) as boolean,
        helpKey: coerceValue(map[CONFIG_KEY.shortcuts.helpKey], bootDefaults.shortcuts.helpKey) as string,
        sequenceTimeoutMs: coerceValue(
          map[CONFIG_KEY.shortcuts.sequenceTimeoutMs],
          bootDefaults.shortcuts.sequenceTimeoutMs,
        ) as number,
      },
    };
  }, [appConfig]);
}
