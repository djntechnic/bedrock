/**
 * @file GridColumnsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Column-level settings editor (app_grid_column_settings). A column
 *              picker drives a single-column detail form; each configuration
 *              group is a persisted CollapsibleSection so an admin can focus on
 *              one aspect at a time. Phase 7 F2 retired the "Bucket-④ stubs"
 *              section: `pinned`, `allow_filter`, `default_filter`, `resizable`,
 *              and `group_by` now all round-trip into a live `<DataGrid>`
 *              consumer via TanStack column pinning / filtering / resizing /
 *              grouping (see DataGrid.tsx columnPinning / columnFilters memos).
 *
 *              Phase 6A adds column-level CRUD: an "+ Add column" dialog that
 *              picks from the dataset schema registry (Phase 6B) OR takes a
 *              custom id, and a per-column "Remove" trash button gated on the
 *              editor's `read_only` flag. Both go through the shared draft
 *              lifecycle map so Save reconciles inserts and deletes alongside
 *              the existing PATCH diff.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import type { GridColumnSetting, GridSetting } from "../../../hooks/useAdminPlatform";
import type { ColumnLifecycle } from "./useGridDraft";
import {
  SwitchRow,
  NumberRow,
  TextRow,
  SelectRow,
  ColorRow,
  TextAreaRow,
} from "./editorFields";
import CollapsibleSection from "./CollapsibleSection";
import { useDatasetSchema } from "./datasetSchemas";
import { log } from "../../../utils/logger";

interface GridColumnsPanelProps {
  draftColumns: GridColumnSetting[];
  draftGrid?: GridSetting | null;
  setColumnField: <K extends keyof GridColumnSetting>(
    columnId: string,
    field: K,
    value: GridColumnSetting[K],
  ) => void;
  /** Phase 6A — the grid whose columns are being edited. Drives dataset schema lookup. */
  gridId?: string | null;
  /** Phase 6A — draft insert; when omitted, the "+ Add column" button hides. */
  insertColumn?: (seed: Partial<GridColumnSetting> & { column_id: string }) => void;
  /** Phase 6A — draft remove; when omitted, the trash button hides. */
  removeColumn?: (columnId: string) => void;
  /** Phase 6A — lifecycle lookup so the panel can badge insert/delete state. */
  columnLifecycle?: (columnId: string) => ColumnLifecycle;
}

const CELL_TYPES = [
  "text",
  "number",
  "badge",
  // Phase 10 B1 — boolean cell primitive. Paired with editable=1, promotes
  // the cell to an interactive <Switch> via <EditableCell>; when not
  // editable, renderCell shows a check glyph vs an em dash.
  "boolean",
  "currency",
  "date",
  "sparkline",
  // Phase 4d Q2 — row-aware media renderers, dispatched by <DataGrid> from
  // the row's sibling fields (player_id/mlb_id, mlb_team_id, photo_url).
  "player_headshot",
  "team_logo",
  "card_thumb",
];
const ALIGNS = ["left", "center", "right"];
const AGG_FNS = ["", "sum", "avg", "min", "max", "count"];
const LINK_TARGETS = [
  "",
  "player_page",
  "player_flyout",
  "card_flyout",
  // Phase 4d Q2 — extend the allowed link surfaces; the underlying routes
  // must exist before enabling in production. Keep values that don't yet
  // route out of this list rather than expose dead links.
  "team_page",
  "card_page",
];

const bool = (v: boolean | number | null | undefined): boolean =>
  typeof v === "boolean" ? v : v === 1;

/** Turn a snake_case column id into a readable default label. */
function humanize(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function GridColumnsPanel({
  draftColumns,
  draftGrid,
  setColumnField,
  gridId = null,
  insertColumn,
  removeColumn,
  columnLifecycle,
}: GridColumnsPanelProps) {
  const ordered = useMemo(() => {
    const cols = [...draftColumns];
    const maxOrder = cols.reduce((m, c) => Math.max(m, c.column_order ?? 0), 0);

    if (bool(draftGrid?.show_ranking) && !cols.some((c) => c.column_id === "ranking")) {
      cols.push({
        grid_setting_id: draftGrid?.grid_setting_id ?? 0,
        column_id: "ranking",
        label_override: "Rank (#)",
        tooltip_override: "Numeric rank column",
        default_visible: true,
        column_order: maxOrder + 1,
        null_display: "—",
        allow_sort: false,
        allow_sort_mode: "none",
        allow_filter: false,
        read_only: true,
        width: 50,
        min_width: 40,
        text_align: "center",
        wrap_text: false,
        resizable: false,
        cell_type: "number",
        group_by: false,
      });
    }

    if (bool(draftGrid?.allow_selection) && !cols.some((c) => c.column_id === "_compare")) {
      cols.push({
        grid_setting_id: draftGrid?.grid_setting_id ?? 0,
        column_id: "_compare",
        label_override: "Selection (Cmp)",
        tooltip_override: "Compare selection column",
        default_visible: true,
        column_order: maxOrder + 2,
        null_display: "—",
        allow_sort: false,
        allow_sort_mode: "none",
        allow_filter: false,
        read_only: true,
        width: 36,
        min_width: 36,
        text_align: "center",
        wrap_text: false,
        resizable: false,
        cell_type: "text",
        group_by: false,
      });
    }

    return cols.sort((a, b) => a.column_order - b.column_order);
  }, [draftColumns, draftGrid?.show_ranking, draftGrid?.allow_selection, draftGrid?.grid_setting_id]);

  const [selectedId, setSelectedId] = useState<string>(
    ordered[0]?.column_id ?? "",
  );
  // Keep the picker's selection valid whenever the underlying draft
  // changes shape (add/remove during the same session).
  useEffect(() => {
    if (ordered.length === 0) return;
    if (!ordered.some((c) => c.column_id === selectedId)) {
      setSelectedId(ordered[0].column_id);
    }
  }, [ordered, selectedId]);

  const col = ordered.find((c) => c.column_id === selectedId) ?? ordered[0];
  const isCustomColumn = col ? col.column_id === "ranking" || col.column_id === "_compare" : false;
  const schema = useDatasetSchema(gridId);
  const configuredIds = useMemo(
    () => new Set(ordered.map((c) => c.column_id)),
    [ordered],
  );

  const reorderColumnToPosition = (targetId: string, requestedOrder: number) => {
    if (Number.isNaN(requestedOrder)) return;
    const targetIndex = Math.max(0, Math.min(ordered.length - 1, Math.round(requestedOrder)));
    const currentCol = ordered.find((c) => c.column_id === targetId);
    if (!currentCol) return;

    const withoutTarget = ordered.filter((c) => c.column_id !== targetId);
    const newOrdered = [
      ...withoutTarget.slice(0, targetIndex),
      currentCol,
      ...withoutTarget.slice(targetIndex),
    ];

    newOrdered.forEach((c, idx) => {
      const nextOrder = idx;
      if (!draftColumns.some((dc) => dc.column_id === c.column_id)) {
        if (insertColumn) {
          insertColumn({ ...c, column_order: nextOrder });
        }
      } else {
        setColumnField(c.column_id, "column_order", nextOrder);
      }
    });
  };

  const handleSetColumnField = <K extends keyof GridColumnSetting>(
    columnId: string,
    field: K,
    value: GridColumnSetting[K],
  ) => {
    if (field === "column_order" && typeof value === "number" && !Number.isNaN(value)) {
      reorderColumnToPosition(columnId, value);
      return;
    }
    if (!draftColumns.some((c) => c.column_id === columnId) && insertColumn) {
      const synthetic = ordered.find((c) => c.column_id === columnId);
      insertColumn({
        ...(synthetic ?? { column_id: columnId }),
        [field]: value,
      });
    } else {
      setColumnField(columnId, field, value);
    }
  };

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const activeLifecycle: ColumnLifecycle = col && columnLifecycle
    ? columnLifecycle(col.column_id)
    : "existing";
  const activeInDataset = col
    ? !schema || schema.columns.includes(col.column_id) || isCustomColumn
    : true;

  return (
    <div className="space-y-3">
      {/* ── Column picker + add/remove toolbar ────────────────────────────── */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Editing column</span>
          {col ? (
            <Select
              value={col.column_id}
              onValueChange={(v) => {
                setSelectedId(v);
                log.info(
                  { component: "GridColumnsPanel", action: "select-column", columnId: v },
                  "GridColumnsPanel: column selected",
                );
              }}
            >
              <SelectTrigger size="sm" className="flex-1 min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ordered.map((c) => (
                  <SelectItem key={c.column_id} value={c.column_id}>
                    {c.label_override || c.column_id}
                    {c.column_id === "ranking" || c.column_id === "_compare" ? " · custom" : c.group_by ? " · grouped" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">No columns yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insertColumn && (
            <AddColumnDialog
              open={addDialogOpen}
              onOpenChange={setAddDialogOpen}
              gridId={gridId}
              schema={schema}
              takenIds={configuredIds}
              onConfirm={(nextId) => {
                insertColumn({
                  column_id: nextId,
                  label_override: humanize(nextId),
                });
                setSelectedId(nextId);
                setAddDialogOpen(false);
              }}
            />
          )}
          {col && removeColumn && col.read_only !== true && !isCustomColumn && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive gap-1"
              onClick={() => setRemoveDialogOpen(true)}
              aria-label={`Remove column ${col.column_id}`}
              data-testid="grid-columns-remove-button"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>

      {col && activeLifecycle !== "existing" && (
        <div
          className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs"
          data-testid="grid-columns-lifecycle-badge"
        >
          <strong>{activeLifecycle === "insert" ? "Pending insert" : "Pending delete"}:</strong>{" "}
          this change applies when you Save.
        </div>
      )}

      {col && !activeInDataset && schema && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
          data-testid="grid-columns-unknown-column-warning"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong>'{col.column_id}'</strong> isn't a known column on this dataset.
            Cells will render empty unless the endpoint emits a{" "}
            <code>{col.column_id}</code> field.{" "}
            <span className="text-muted-foreground">
              Dataset: {schema.source}
            </span>
          </div>
        </div>
      )}

      {col ? (
        <ColumnEditForm col={col} setColumnField={handleSetColumnField} isCustomColumn={isCustomColumn} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No columns configured for this grid. Use "+ Add column" to insert one.
        </p>
      )}

      {/* Remove confirmation lives outside the picker row so it survives
          the picker's dropdown open state changes. */}
      {col && removeColumn && !isCustomColumn && (
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove column '{col.column_id}'?</AlertDialogTitle>
              <AlertDialogDescription>
                The column will be marked for deletion in the draft. Clicking
                Save then permanently removes it from the grid configuration.
                You can revert with Cancel before saving.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  removeColumn(col.column_id);
                  setRemoveDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Mark for delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gridId: string | null;
  schema: ReturnType<typeof useDatasetSchema>;
  takenIds: Set<string>;
  onConfirm: (columnId: string) => void;
}

function AddColumnDialog({
  open,
  onOpenChange,
  schema,
  takenIds,
  onConfirm,
}: AddColumnDialogProps) {
  const [pickerValue, setPickerValue] = useState<string>("");
  const [customValue, setCustomValue] = useState<string>("");

  const availableSchemaCols = useMemo(() => {
    if (!schema) return [];
    return schema.columns.filter((c) => !takenIds.has(c));
  }, [schema, takenIds]);

  useEffect(() => {
    if (!open) {
      setPickerValue("");
      setCustomValue("");
    }
  }, [open]);

  const chosen = (pickerValue || customValue).trim();
  const isDuplicate = takenIds.has(chosen);
  const isValid = chosen.length > 0 && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          data-testid="grid-columns-add-button"
        >
          <Plus className="h-3.5 w-3.5" /> Add column
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            {schema
              ? `Pick a known column from ${schema.source} or type a custom id.`
              : "Type a column id. The dataset for this grid isn't registered — column ids won't be validated."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {schema && availableSchemaCols.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Known columns
              </Label>
              <Select
                value={pickerValue}
                onValueChange={(v) => {
                  setPickerValue(v);
                  setCustomValue("");
                }}
              >
                <SelectTrigger size="sm" data-testid="grid-columns-add-picker">
                  <SelectValue placeholder="— Select a column —" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchemaCols.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {schema ? "Or custom column id" : "Column id"}
            </Label>
            <Input
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                setPickerValue("");
              }}
              placeholder="e.g. runs_created"
              data-testid="grid-columns-add-custom"
              aria-invalid={isDuplicate || undefined}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">
                A column with this id is already configured.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!isValid}
            onClick={() => isValid && onConfirm(chosen)}
            data-testid="grid-columns-add-confirm"
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ColumnEditFormProps {
  col: GridColumnSetting;
  setColumnField: <K extends keyof GridColumnSetting>(
    columnId: string,
    field: K,
    value: GridColumnSetting[K],
  ) => void;
  isCustomColumn?: boolean;
}

/**
 * The original settings form, split into its own component so the parent
 * can conditionally render it (a fresh grid with zero columns shows the
 * empty state above instead).
 */
function ColumnEditForm({ col, setColumnField, isCustomColumn }: ColumnEditFormProps) {
  const set = <K extends keyof GridColumnSetting>(field: K, value: GridColumnSetting[K]) =>
    setColumnField(col.column_id, field, value);

  return (
    <>
      {isCustomColumn && (
        <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          This is an injected custom column. Non-applicable settings (cell type, format, filters, grouping, colors) are disabled.
        </div>
      )}

      <CollapsibleSection storageKey="col.identity" title="Identity & layout">
        <TextRow label="Label override" value={col.label_override ?? ""}
          placeholder={col.column_id} onChange={(v) => set("label_override", v || null)} />
        <TextRow label="Tooltip override" value={col.tooltip_override ?? ""}
          onChange={(v) => set("tooltip_override", v || null)} />
        <NumberRow label="Column order" value={col.column_order}
          onChange={(v) => set("column_order", Number.isNaN(v) ? 0 : v)} />
        <SwitchRow label="Visible by default" checked={bool(col.default_visible)}
          onChange={(v) => set("default_visible", v)} />
        <SelectRow label="Sort mode" value={col.allow_sort_mode ?? (col.allow_sort ? "both" : "none")}
          disabled={isCustomColumn}
          options={[
            { value: "none", label: "Disabled" },
            { value: "both", label: "Bi-directional (default)" },
            { value: "asc", label: "Ascending only (locked)" },
            { value: "desc", label: "Descending only (locked)" },
          ]}
          onChange={(v) => {
            const mode = v as "none" | "asc" | "desc" | "both";
            set("allow_sort_mode", mode);
            // Keep the legacy boolean in sync during the parallel-support window
            // so callers still consulting allow_sort see the same intent.
            set("allow_sort", mode !== "none");
          }} />
        <SelectRow label="Default sort (per column)" value={col.default_sort ?? ""}
          disabled={isCustomColumn}
          options={[
            { value: "", label: "— none —" },
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" },
          ]}
          onChange={(v) => set("default_sort", v || null)} />
        <SwitchRow label="Read only (hidden from toggle)" checked={bool(col.read_only)}
          disabled={isCustomColumn}
          onChange={(v) => set("read_only", v)} />
        <SelectRow label="Text align" value={col.text_align ?? "left"}
          options={ALIGNS.map((a) => ({ value: a, label: a }))}
          onChange={(v) => set("text_align", v)} />
        <NumberRow label="Width (px)" value={col.width ?? undefined}
          onChange={(v) => set("width", Number.isNaN(v) ? null : v)} />
        <NumberRow label="Min width (px)" value={col.min_width}
          onChange={(v) => set("min_width", Number.isNaN(v) ? 60 : v)} />
        <NumberRow label="Max width (px)" value={col.max_width ?? undefined}
          onChange={(v) => set("max_width", Number.isNaN(v) ? null : v)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="col.formatting" title="Formatting & behavior">
        <SelectRow label="Cell type" value={col.cell_type ?? "text"}
          disabled={isCustomColumn}
          options={CELL_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={(v) => set("cell_type", v)} />
        <TextRow label="Format string" value={col.format_string ?? ""}
          disabled={isCustomColumn}
          placeholder=".3f" onChange={(v) => set("format_string", v || null)}
          help={
            <div className="space-y-1">
              <p>Only applies when Cell type is <strong>number</strong>. Accepted tokens:</p>
              <ul className="list-disc pl-3.5 space-y-0.5">
                <li><code>.3f</code> / <code>0.000</code> — 3 decimals (e.g. <code>.300</code>)</li>
                <li><code>.2f</code> / <code>0.00</code> — 2 decimals (e.g. <code>1.25</code>)</li>
                <li><code>.1f</code> / <code>0.0</code> — 1 decimal (e.g. <code>6.1</code>)</li>
                <li>anything else / blank — rounds to an integer <strong>with</strong> a thousands separator (e.g. <code>2,026</code>)</li>
              </ul>
              <p>There is no number token for a plain, ungrouped integer. For IDs, years, or
                 codes (e.g. <code>2026</code>, not <code>2,026</code>), set Cell type to
                 <strong> text</strong> instead and leave this blank.</p>
              <p>For currency (e.g. <code>$1,234.56</code>), set Cell type to
                 <strong> currency</strong> — this field is ignored.</p>
            </div>
          } />
        <TextRow label="Null display" value={col.null_display ?? "—"}
          disabled={isCustomColumn}
          onChange={(v) => set("null_display", v)} />
        <SelectRow label="Aggregate function" value={col.aggregate_function ?? ""}
          disabled={isCustomColumn}
          options={AGG_FNS.map((a) => ({ value: a, label: a || "— none —" }))}
          onChange={(v) => set("aggregate_function", v || null)} />
        <SelectRow label="Link target" value={col.link_target ?? ""}
          disabled={isCustomColumn}
          options={LINK_TARGETS.map((a) => ({ value: a, label: a || "— none —" }))}
          onChange={(v) => set("link_target", v || null)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="col.colors" title="Colors & gradient">
        <ColorRow label="Sort ascending" value={col.sort_asc_color}
          disabled={isCustomColumn}
          onChange={(v) => set("sort_asc_color", v)} />
        <ColorRow label="Sort descending" value={col.sort_desc_color}
          disabled={isCustomColumn}
          onChange={(v) => set("sort_desc_color", v)} />
        <ColorRow label="Gradient from" value={col.gradient_from_color}
          disabled={isCustomColumn}
          onChange={(v) => set("gradient_from_color", v)} />
        <ColorRow label="Gradient to" value={col.gradient_to_color}
          disabled={isCustomColumn}
          onChange={(v) => set("gradient_to_color", v)} />
        <TextAreaRow label="Conditional format (JSON)" value={col.conditional_format ?? ""}
          disabled={isCustomColumn}
          placeholder='[{"op":"gte","value":0.9,"color":"emerald"}]'
          onChange={(v) => set("conditional_format", v || null)} />
      </CollapsibleSection>

      <CollapsibleSection storageKey="col.behavior" title="Column behavior"
        subtitle="Pinning, filtering, resizing, and grouping (all config-driven).">
        <SelectRow label="Pinned" value={col.pinned ?? ""}
          options={[
            { value: "", label: "— none —" },
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
          ]}
          onChange={(v) => set("pinned", (v || null) as GridColumnSetting["pinned"])} />
        <SwitchRow label="Allow filter" checked={bool(col.allow_filter)}
          disabled={isCustomColumn}
          onChange={(v) => set("allow_filter", v)} />
        <TextRow label="Default filter (JSON or literal)" value={col.default_filter ?? ""}
          disabled={isCustomColumn}
          placeholder='"MLB" or {"op":"gte","value":10}'
          onChange={(v) => set("default_filter", v || null)} />
        <SwitchRow label="Resizable" checked={bool(col.resizable)}
          onChange={(v) => set("resizable", v)} />
        <SwitchRow label="Group by" checked={bool(col.group_by)}
          disabled={isCustomColumn}
          onChange={(v) => set("group_by", v)} />
        {bool(col.group_by) && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Rows collapse under this column. Pagination is suspended while
            grouping is active so aggregate counts stay accurate.
          </p>
        )}
        <SwitchRow label="Wrap text (column override)" checked={bool(col.wrap_text)}
          disabled={isCustomColumn}
          onChange={(v) => set("wrap_text", v)} />
        <SwitchRow label="Editable (inline editor)" checked={bool(col.editable)}
          disabled={isCustomColumn}
          onChange={(v) => set("editable", v)} />
        {bool(col.editable) && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Cells become double-click editors when the host grid supplies
            an <code>onCellCommit</code> handler. Grid-level{" "}
            <code>read_only</code> disables editing across every column
            regardless of this flag.
          </p>
        )}
      </CollapsibleSection>
    </>
  );
}
