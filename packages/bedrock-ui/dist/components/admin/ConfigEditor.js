import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Switch } from "../ui/switch.js";
import { useConfigSettings, useUpdateConfig } from "../../hooks/useAdminPlatform.js";
function groupByCategory(settings) {
  const groups = /* @__PURE__ */ new Map();
  for (const setting of settings) {
    const key = setting.category || "uncategorised";
    const bucket = groups.get(key);
    if (bucket) bucket.push(setting);
    else groups.set(key, [setting]);
  }
  return [...groups.entries()];
}
function isBool(setting) {
  return setting.value_type === "bool";
}
function boolValue(value) {
  return value === "true" || value === "1";
}
function ConfigEditor() {
  const settings = useConfigSettings();
  const update = useUpdateConfig();
  const [drafts, setDrafts] = useState({});
  const rows = settings.data?.data ?? [];
  const commit = (key, value) => {
    update.mutate(
      { key, value },
      {
        onSuccess: () => setDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        })
      }
    );
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs(
        Button,
        {
          size: "sm",
          variant: "secondary",
          onClick: () => void settings.refetch(),
          disabled: settings.isFetching,
          children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            "Refresh"
          ]
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
        rows.length,
        " setting",
        rows.length === 1 ? "" : "s"
      ] }),
      update.isError && /* @__PURE__ */ jsx("span", { role: "alert", className: "text-xs text-destructive", children: "Save failed." })
    ] }),
    groupByCategory(rows).map(([category, group]) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-border", children: [
      /* @__PURE__ */ jsx("div", { className: "border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground", children: category }),
      /* @__PURE__ */ jsx("table", { className: "w-full text-sm", children: /* @__PURE__ */ jsx("tbody", { children: group.map((setting) => {
        const draft = drafts[setting.key];
        const dirty = draft !== void 0 && draft !== (setting.value ?? "");
        return /* @__PURE__ */ jsxs(
          "tr",
          {
            className: "border-b border-border last:border-0 align-top",
            children: [
              /* @__PURE__ */ jsxs("td", { className: "px-3 py-2 w-1/3", children: [
                /* @__PURE__ */ jsx("div", { className: "font-mono text-xs", children: setting.key }),
                setting.description && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground", children: setting.description })
              ] }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: isBool(setting) ? /* @__PURE__ */ jsx(
                Switch,
                {
                  checked: boolValue(setting.value),
                  "aria-label": setting.key,
                  onCheckedChange: (checked) => commit(setting.key, checked ? "true" : "false")
                }
              ) : /* @__PURE__ */ jsx(
                Input,
                {
                  className: "h-8 text-xs",
                  "aria-label": setting.key,
                  value: draft ?? setting.value ?? "",
                  onChange: (e) => setDrafts((current) => ({
                    ...current,
                    [setting.key]: e.target.value
                  }))
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 w-24 text-right", children: !isBool(setting) && /* @__PURE__ */ jsxs(
                Button,
                {
                  size: "sm",
                  variant: "secondary",
                  disabled: !dirty || update.isPending,
                  onClick: () => commit(setting.key, draft ?? ""),
                  children: [
                    /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
                    "Save"
                  ]
                }
              ) })
            ]
          },
          setting.key
        );
      }) }) })
    ] }, category))
  ] });
}
export {
  boolValue,
  ConfigEditor as default,
  groupByCategory
};
//# sourceMappingURL=ConfigEditor.js.map
