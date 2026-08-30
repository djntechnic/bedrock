import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { Upload, AlertTriangle, FileJson } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../ui/dialog.js";
import { Button } from "../../ui/button.js";
import { Label } from "../../ui/label.js";
import { cn } from "../../../lib/utils.js";
import { log } from "../../../utils/logger.js";
import { parseGridConfigJson, planImport, readFileAsText } from "./importGridConfig.js";
function ImportGridConfigDialog({
  gridId,
  draftGrid,
  draftColumns,
  onApply,
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseError, setParseError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [summary, setSummary] = useState(null);
  function resetState() {
    setRaw("");
    setParseError(null);
    setPayload(null);
    setSummary(null);
  }
  function tryParse(nextRaw) {
    setRaw(nextRaw);
    if (!nextRaw.trim()) {
      setParseError(null);
      setPayload(null);
      setSummary(null);
      return;
    }
    try {
      const parsed = parseGridConfigJson(nextRaw);
      setPayload(parsed);
      setParseError(null);
      if (draftGrid) {
        setSummary(
          planImport(
            { grid: draftGrid, columns: draftColumns },
            parsed,
            gridId
          )
        );
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
      setPayload(null);
      setSummary(null);
    }
  }
  async function handleFile(file) {
    try {
      const text = await readFileAsText(file);
      tryParse(text);
    } catch (error) {
      setParseError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  function handleApply() {
    if (!payload || !summary) return;
    onApply(payload);
    log.info(
      {
        gridId,
        action: "import.apply",
        added: summary.added.length,
        removed: summary.removed.length,
        changed: summary.changed.length,
        gridFieldsChanged: summary.gridFieldsChanged.length,
        warnings: summary.warnings.length
      },
      "ImportGridConfigDialog: applied import to draft"
    );
    setOpen(false);
    resetState();
  }
  return /* @__PURE__ */ jsxs(
    Dialog,
    {
      open,
      onOpenChange: (next) => {
        setOpen(next);
        if (!next) resetState();
      },
      children: [
        /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            className: "gap-1.5",
            disabled,
            "aria-label": "Import grid config from JSON",
            "data-testid": "grid-editor-import-button",
            children: [
              /* @__PURE__ */ jsx(Upload, { className: "h-3.5 w-3.5" }),
              " Import JSON"
            ]
          }
        ) }),
        /* @__PURE__ */ jsxs(DialogContent, { className: "sm:max-w-2xl", children: [
          /* @__PURE__ */ jsxs(DialogHeader, { children: [
            /* @__PURE__ */ jsx(DialogTitle, { children: "Import grid config" }),
            /* @__PURE__ */ jsx(DialogDescription, { children: "Load a GridConfigExport JSON payload. Identity fields (grid_id, grid_label, grid_setting_id, column_setting_id) are ignored — the import is applied to the currently open grid. Nothing persists until you Save the draft." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsx(Label, { className: "text-xs text-muted-foreground", children: "JSON file" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "file",
                  accept: "application/json,.json",
                  onChange: (e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  },
                  className: "block w-full text-xs",
                  "data-testid": "grid-editor-import-file"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
              /* @__PURE__ */ jsx(Label, { className: "text-xs text-muted-foreground", children: "Or paste JSON" }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  value: raw,
                  onChange: (e) => tryParse(e.target.value),
                  placeholder: '{ "exportedAt": "...", "exportVersion": 1, "grid": { ... }, "columns": [ ... ] }',
                  rows: 8,
                  className: "w-full rounded-md border bg-background px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "data-testid": "grid-editor-import-textarea"
                }
              )
            ] }),
            parseError && /* @__PURE__ */ jsxs(
              "div",
              {
                role: "alert",
                className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
                "data-testid": "grid-editor-import-error",
                children: [
                  /* @__PURE__ */ jsx(AlertTriangle, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }),
                  /* @__PURE__ */ jsx("div", { children: parseError })
                ]
              }
            ),
            payload && summary && /* @__PURE__ */ jsxs(
              "div",
              {
                className: "rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-2",
                "data-testid": "grid-editor-import-summary",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 font-medium", children: [
                    /* @__PURE__ */ jsx(FileJson, { className: "h-3.5 w-3.5" }),
                    "Import summary"
                  ] }),
                  /* @__PURE__ */ jsxs("ul", { className: "grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground", children: [
                    /* @__PURE__ */ jsxs("li", { children: [
                      /* @__PURE__ */ jsx("span", { className: "text-emerald-600", children: "+" }),
                      " ",
                      summary.added.length,
                      " column",
                      summary.added.length === 1 ? "" : "s",
                      " added"
                    ] }),
                    /* @__PURE__ */ jsxs("li", { children: [
                      /* @__PURE__ */ jsx("span", { className: "text-destructive", children: "−" }),
                      " ",
                      summary.removed.length,
                      " column",
                      summary.removed.length === 1 ? "" : "s",
                      " removed"
                    ] }),
                    /* @__PURE__ */ jsxs("li", { children: [
                      /* @__PURE__ */ jsx("span", { className: "text-amber-600", children: "~" }),
                      " ",
                      summary.changed.length,
                      " column",
                      summary.changed.length === 1 ? "" : "s",
                      " changed"
                    ] }),
                    /* @__PURE__ */ jsxs("li", { children: [
                      summary.gridFieldsChanged.length,
                      " grid field",
                      summary.gridFieldsChanged.length === 1 ? "" : "s",
                      " updated"
                    ] })
                  ] }),
                  summary.warnings.length > 0 && /* @__PURE__ */ jsxs(
                    "div",
                    {
                      className: cn(
                        "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-900 dark:text-amber-200"
                      ),
                      "data-testid": "grid-editor-import-warnings",
                      children: [
                        /* @__PURE__ */ jsx(AlertTriangle, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }),
                        /* @__PURE__ */ jsx("ul", { className: "space-y-1", children: summary.warnings.map((w) => /* @__PURE__ */ jsx("li", { children: w }, w)) })
                      ]
                    }
                  )
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(DialogFooter, { children: [
            /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => setOpen(false), children: "Cancel" }),
            /* @__PURE__ */ jsx(
              Button,
              {
                disabled: !payload || !summary,
                onClick: handleApply,
                "data-testid": "grid-editor-import-confirm",
                children: "Apply to draft"
              }
            )
          ] })
        ] })
      ]
    }
  );
}
export {
  ImportGridConfigDialog as default
};
//# sourceMappingURL=ImportGridConfigDialog.js.map
