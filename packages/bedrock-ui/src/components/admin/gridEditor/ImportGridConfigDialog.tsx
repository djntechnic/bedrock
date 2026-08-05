/**
 * @file ImportGridConfigDialog.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Phase 6C — modal that accepts a GridConfigExport JSON payload
 *              (file upload or paste), previews the resulting diff against
 *              the current draft (added / removed / changed columns +
 *              grid-level field diffs + dataset warnings), and applies the
 *              payload to the draft on confirm. The admin still has to Save
 *              to persist — the dialog only stages changes.
 */

import { useState } from "react";
import { Upload, FileJson, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { cn } from "../../../lib/utils";
import { log } from "../../../utils/logger";
import type { GridSetting, GridColumnSetting } from "../../../hooks/useAdminPlatform";
import type { GridConfigExport } from "./exportGridConfig";
import {
  parseGridConfigJson,
  planImport,
  readFileAsText,
  type ImportSummary,
} from "./importGridConfig";

interface ImportGridConfigDialogProps {
  gridId: string | null;
  draftGrid: GridSetting | null;
  draftColumns: GridColumnSetting[];
  onApply: (payload: GridConfigExport) => void;
  /** Optional external opener — the dialog also renders its own trigger button. */
  disabled?: boolean;
}

export default function ImportGridConfigDialog({
  gridId,
  draftGrid,
  draftColumns,
  onApply,
  disabled = false,
}: ImportGridConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [payload, setPayload] = useState<GridConfigExport | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function resetState() {
    setRaw("");
    setParseError(null);
    setPayload(null);
    setSummary(null);
  }

  function tryParse(nextRaw: string) {
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
            gridId,
          ),
        );
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
      setPayload(null);
      setSummary(null);
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await readFileAsText(file);
      tryParse(text);
    } catch (error) {
      setParseError(
        `Failed to read file: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
        warnings: summary.warnings.length,
      },
      "ImportGridConfigDialog: applied import to draft",
    );
    setOpen(false);
    resetState();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          aria-label="Import grid config from JSON"
          data-testid="grid-editor-import-button"
        >
          <Upload className="h-3.5 w-3.5" /> Import JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import grid config</DialogTitle>
          <DialogDescription>
            Load a GridConfigExport JSON payload. Identity fields (grid_id,
            grid_label, grid_setting_id, column_setting_id) are ignored — the
            import is applied to the currently open grid. Nothing persists
            until you Save the draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">JSON file</Label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="block w-full text-xs"
              data-testid="grid-editor-import-file"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Or paste JSON
            </Label>
            <textarea
              value={raw}
              onChange={(e) => tryParse(e.target.value)}
              placeholder='{ "exportedAt": "...", "exportVersion": 1, "grid": { ... }, "columns": [ ... ] }'
              rows={8}
              className="w-full rounded-md border bg-background px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="grid-editor-import-textarea"
            />
          </div>

          {parseError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              data-testid="grid-editor-import-error"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>{parseError}</div>
            </div>
          )}

          {payload && summary && (
            <div
              className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-2"
              data-testid="grid-editor-import-summary"
            >
              <div className="flex items-center gap-2 font-medium">
                <FileJson className="h-3.5 w-3.5" />
                Import summary
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <li>
                  <span className="text-emerald-600">+</span>{" "}
                  {summary.added.length} column
                  {summary.added.length === 1 ? "" : "s"} added
                </li>
                <li>
                  <span className="text-destructive">−</span>{" "}
                  {summary.removed.length} column
                  {summary.removed.length === 1 ? "" : "s"} removed
                </li>
                <li>
                  <span className="text-amber-600">~</span>{" "}
                  {summary.changed.length} column
                  {summary.changed.length === 1 ? "" : "s"} changed
                </li>
                <li>
                  {summary.gridFieldsChanged.length} grid field
                  {summary.gridFieldsChanged.length === 1 ? "" : "s"} updated
                </li>
              </ul>
              {summary.warnings.length > 0 && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-900 dark:text-amber-200",
                  )}
                  data-testid="grid-editor-import-warnings"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <ul className="space-y-1">
                    {summary.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!payload || !summary}
            onClick={handleApply}
            data-testid="grid-editor-import-confirm"
          >
            Apply to draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
