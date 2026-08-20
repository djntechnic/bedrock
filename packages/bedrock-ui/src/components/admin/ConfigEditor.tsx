/**
 * @file ConfigEditor.tsx
 * @module frontend/src/components/admin
 * @description Every config row, grouped by category, editable in place.
 *
 * The generic settings editor — the one that reaches keys no bespoke screen
 * covers. A consumer that also ships a purpose-built panel for a handful of
 * settings keeps it; this is the admin-role view of the whole table.
 *
 * Keys are never created or deleted here. A key exists because code reads it
 * with a default, so inventing one from a form produces a row nothing reads.
 * `useCreateConfig` and `useDeleteConfig` are exported by the platform and
 * deliberately unused here.
 */
import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import {
  useConfigSettings,
  useUpdateConfig,
  type ConfigSetting,
} from "../../hooks/useAdminPlatform";

/** Group by `category`, preserving first-seen order within the response. */
export function groupByCategory(
  settings: ConfigSetting[],
): Array<[string, ConfigSetting[]]> {
  const groups = new Map<string, ConfigSetting[]>();
  for (const setting of settings) {
    const key = setting.category || "uncategorised";
    const bucket = groups.get(key);
    if (bucket) bucket.push(setting);
    else groups.set(key, [setting]);
  }
  return [...groups.entries()];
}

/** `bool` rows render a Switch; everything else is a text box. */
function isBool(setting: ConfigSetting) {
  return setting.value_type === "bool";
}

/** The two spellings the backend accepts for true. */
export function boolValue(value: string | null) {
  return value === "true" || value === "1";
}

export default function ConfigEditor() {
  const settings = useConfigSettings();
  const update = useUpdateConfig();

  /** Pending edits, keyed by config key. Absent means "unchanged". */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const rows = settings.data?.data ?? [];

  const commit = (key: string, value: string) => {
    update.mutate(
      { key, value },
      {
        onSuccess: () =>
          setDrafts((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void settings.refetch()}
          disabled={settings.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        <span className="text-xs text-muted-foreground">
          {rows.length} setting{rows.length === 1 ? "" : "s"}
        </span>
        {update.isError && (
          <span role="alert" className="text-xs text-destructive">
            Save failed.
          </span>
        )}
      </div>

      {groupByCategory(rows).map(([category, group]) => (
        <div key={category} className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            {category}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {group.map((setting) => {
                const draft = drafts[setting.key];
                const dirty = draft !== undefined && draft !== (setting.value ?? "");
                return (
                  <tr
                    key={setting.key}
                    className="border-b border-border last:border-0 align-top"
                  >
                    <td className="px-3 py-2 w-1/3">
                      <div className="font-mono text-xs">{setting.key}</div>
                      {setting.description && (
                        <div className="text-xs text-muted-foreground">
                          {setting.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isBool(setting) ? (
                        <Switch
                          checked={boolValue(setting.value)}
                          aria-label={setting.key}
                          onCheckedChange={(checked) =>
                            commit(setting.key, checked ? "true" : "false")
                          }
                        />
                      ) : (
                        <Input
                          className="h-8 text-xs"
                          aria-label={setting.key}
                          // `?? ""` rather than the raw value: a null from the
                          // API would make this input uncontrolled on the
                          // first render and controlled on the next.
                          value={draft ?? setting.value ?? ""}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [setting.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 w-24 text-right">
                      {!isBool(setting) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!dirty || update.isPending}
                          onClick={() => commit(setting.key, draft ?? "")}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
