import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from "react";
import { Trash2, AlertTriangle, Plus } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select.js";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../ui/dialog.js";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../../ui/alert-dialog.js";
import { Input } from "../../ui/input.js";
import { Button } from "../../ui/button.js";
import { Label } from "../../ui/label.js";
import { TextRow, NumberRow, SwitchRow, SelectRow, ColorRow, TextAreaRow } from "./editorFields.js";
import CollapsibleSection from "./CollapsibleSection.js";
import { useDatasetSchema } from "./datasetSchemas.js";
import { log } from "../../../utils/logger.js";
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
  "card_thumb"
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
  "card_page"
];
const bool = (v) => typeof v === "boolean" ? v : v === 1;
function humanize(id) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function GridColumnsPanel({
  draftColumns,
  draftGrid,
  setColumnField,
  gridId = null,
  insertColumn,
  removeColumn,
  columnLifecycle
}) {
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
        group_by: false
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
        group_by: false
      });
    }
    return cols.sort((a, b) => a.column_order - b.column_order);
  }, [draftColumns, draftGrid?.show_ranking, draftGrid?.allow_selection, draftGrid?.grid_setting_id]);
  const [selectedId, setSelectedId] = useState(
    ordered[0]?.column_id ?? ""
  );
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
    [ordered]
  );
  const reorderColumnToPosition = (targetId, requestedOrder) => {
    if (Number.isNaN(requestedOrder)) return;
    const targetIndex = Math.max(0, Math.min(ordered.length - 1, Math.round(requestedOrder)));
    const currentCol = ordered.find((c) => c.column_id === targetId);
    if (!currentCol) return;
    const withoutTarget = ordered.filter((c) => c.column_id !== targetId);
    const newOrdered = [
      ...withoutTarget.slice(0, targetIndex),
      currentCol,
      ...withoutTarget.slice(targetIndex)
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
  const handleSetColumnField = (columnId, field, value) => {
    if (field === "column_order" && typeof value === "number" && !Number.isNaN(value)) {
      reorderColumnToPosition(columnId, value);
      return;
    }
    if (!draftColumns.some((c) => c.column_id === columnId) && insertColumn) {
      const synthetic = ordered.find((c) => c.column_id === columnId);
      insertColumn({
        ...synthetic ?? { column_id: columnId },
        [field]: value
      });
    } else {
      setColumnField(columnId, field, value);
    }
  };
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const activeLifecycle = col && columnLifecycle ? columnLifecycle(col.column_id) : "existing";
  const activeInDataset = col ? !schema || schema.columns.includes(col.column_id) || isCustomColumn : true;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5 px-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0", children: "Editing column" }),
        col ? /* @__PURE__ */ jsxs(
          Select,
          {
            value: col.column_id,
            onValueChange: (v) => {
              setSelectedId(v);
              log.info(
                { component: "GridColumnsPanel", action: "select-column", columnId: v },
                "GridColumnsPanel: column selected"
              );
            },
            children: [
              /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", className: "flex-1 min-w-0", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsx(SelectContent, { children: ordered.map((c) => /* @__PURE__ */ jsxs(SelectItem, { value: c.column_id, children: [
                c.label_override || c.column_id,
                c.column_id === "ranking" || c.column_id === "_compare" ? " · custom" : c.group_by ? " · grouped" : ""
              ] }, c.column_id)) })
            ]
          }
        ) : /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "No columns yet" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        insertColumn && /* @__PURE__ */ jsx(
          AddColumnDialog,
          {
            open: addDialogOpen,
            onOpenChange: setAddDialogOpen,
            gridId,
            schema,
            takenIds: configuredIds,
            onConfirm: (nextId) => {
              insertColumn({
                column_id: nextId,
                label_override: humanize(nextId)
              });
              setSelectedId(nextId);
              setAddDialogOpen(false);
            }
          }
        ),
        col && removeColumn && col.read_only !== true && !isCustomColumn && /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "text-destructive gap-1",
            onClick: () => setRemoveDialogOpen(true),
            "aria-label": `Remove column ${col.column_id}`,
            "data-testid": "grid-columns-remove-button",
            children: [
              /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5" }),
              " Remove"
            ]
          }
        )
      ] })
    ] }),
    col && activeLifecycle !== "existing" && /* @__PURE__ */ jsxs(
      "div",
      {
        className: "rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs",
        "data-testid": "grid-columns-lifecycle-badge",
        children: [
          /* @__PURE__ */ jsxs("strong", { children: [
            activeLifecycle === "insert" ? "Pending insert" : "Pending delete",
            ":"
          ] }),
          " ",
          "this change applies when you Save."
        ]
      }
    ),
    col && !activeInDataset && schema && /* @__PURE__ */ jsxs(
      "div",
      {
        role: "status",
        className: "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200",
        "data-testid": "grid-columns-unknown-column-warning",
        children: [
          /* @__PURE__ */ jsx(AlertTriangle, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("strong", { children: [
              "'",
              col.column_id,
              "'"
            ] }),
            " isn't a known column on this dataset. Cells will render empty unless the endpoint emits a",
            " ",
            /* @__PURE__ */ jsx("code", { children: col.column_id }),
            " field.",
            " ",
            /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground", children: [
              "Dataset: ",
              schema.source
            ] })
          ] })
        ]
      }
    ),
    col ? /* @__PURE__ */ jsx(ColumnEditForm, { col, setColumnField: handleSetColumnField, isCustomColumn }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: 'No columns configured for this grid. Use "+ Add column" to insert one.' }),
    col && removeColumn && !isCustomColumn && /* @__PURE__ */ jsx(AlertDialog, { open: removeDialogOpen, onOpenChange: setRemoveDialogOpen, children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsxs(AlertDialogTitle, { children: [
          "Remove column '",
          col.column_id,
          "'?"
        ] }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { children: "The column will be marked for deletion in the draft. Clicking Save then permanently removes it from the grid configuration. You can revert with Cancel before saving." })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogCancel, { children: "Cancel" }),
        /* @__PURE__ */ jsx(
          AlertDialogAction,
          {
            onClick: () => {
              removeColumn(col.column_id);
              setRemoveDialogOpen(false);
            },
            className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            children: "Mark for delete"
          }
        )
      ] })
    ] }) })
  ] });
}
function AddColumnDialog({
  open,
  onOpenChange,
  schema,
  takenIds,
  onConfirm
}) {
  const [pickerValue, setPickerValue] = useState("");
  const [customValue, setCustomValue] = useState("");
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
  return /* @__PURE__ */ jsxs(Dialog, { open, onOpenChange, children: [
    /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      Button,
      {
        variant: "outline",
        size: "sm",
        className: "gap-1",
        "data-testid": "grid-columns-add-button",
        children: [
          /* @__PURE__ */ jsx(Plus, { className: "h-3.5 w-3.5" }),
          " Add column"
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(DialogContent, { className: "sm:max-w-md", children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: "Add column" }),
        /* @__PURE__ */ jsx(DialogDescription, { children: schema ? `Pick a known column from ${schema.source} or type a custom id.` : "Type a column id. The dataset for this grid isn't registered — column ids won't be validated." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        schema && availableSchemaCols.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx(Label, { className: "text-xs text-muted-foreground", children: "Known columns" }),
          /* @__PURE__ */ jsxs(
            Select,
            {
              value: pickerValue,
              onValueChange: (v) => {
                setPickerValue(v);
                setCustomValue("");
              },
              children: [
                /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", "data-testid": "grid-columns-add-picker", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "— Select a column —" }) }),
                /* @__PURE__ */ jsx(SelectContent, { children: availableSchemaCols.map((c) => /* @__PURE__ */ jsx(SelectItem, { value: c, children: c }, c)) })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsx(Label, { className: "text-xs text-muted-foreground", children: schema ? "Or custom column id" : "Column id" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              value: customValue,
              onChange: (e) => {
                setCustomValue(e.target.value);
                setPickerValue("");
              },
              placeholder: "e.g. runs_created",
              "data-testid": "grid-columns-add-custom",
              "aria-invalid": isDuplicate || void 0
            }
          ),
          isDuplicate && /* @__PURE__ */ jsx("p", { className: "text-xs text-destructive", children: "A column with this id is already configured." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(DialogFooter, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: () => onOpenChange(false), children: "Cancel" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            disabled: !isValid,
            onClick: () => isValid && onConfirm(chosen),
            "data-testid": "grid-columns-add-confirm",
            children: "Add"
          }
        )
      ] })
    ] })
  ] });
}
function ColumnEditForm({ col, setColumnField, isCustomColumn }) {
  const set = (field, value) => setColumnField(col.column_id, field, value);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    isCustomColumn && /* @__PURE__ */ jsx("div", { className: "rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground", children: "This is an injected custom column. Non-applicable settings (cell type, format, filters, grouping, colors) are disabled." }),
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "col.identity", title: "Identity & layout", children: [
      /* @__PURE__ */ jsx(
        TextRow,
        {
          label: "Label override",
          value: col.label_override ?? "",
          placeholder: col.column_id,
          onChange: (v) => set("label_override", v || null)
        }
      ),
      /* @__PURE__ */ jsx(
        TextRow,
        {
          label: "Tooltip override",
          value: col.tooltip_override ?? "",
          onChange: (v) => set("tooltip_override", v || null)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Column order",
          value: col.column_order,
          onChange: (v) => set("column_order", Number.isNaN(v) ? 0 : v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Visible by default",
          checked: bool(col.default_visible),
          onChange: (v) => set("default_visible", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Sort mode",
          value: col.allow_sort_mode ?? (col.allow_sort ? "both" : "none"),
          disabled: isCustomColumn,
          options: [
            { value: "none", label: "Disabled" },
            { value: "both", label: "Bi-directional (default)" },
            { value: "asc", label: "Ascending only (locked)" },
            { value: "desc", label: "Descending only (locked)" }
          ],
          onChange: (v) => {
            const mode = v;
            set("allow_sort_mode", mode);
            set("allow_sort", mode !== "none");
          }
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Default sort (per column)",
          value: col.default_sort ?? "",
          disabled: isCustomColumn,
          options: [
            { value: "", label: "— none —" },
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" }
          ],
          onChange: (v) => set("default_sort", v || null)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Read only (hidden from toggle)",
          checked: bool(col.read_only),
          disabled: isCustomColumn,
          onChange: (v) => set("read_only", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Text align",
          value: col.text_align ?? "left",
          options: ALIGNS.map((a) => ({ value: a, label: a })),
          onChange: (v) => set("text_align", v)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Width (px)",
          value: col.width ?? void 0,
          onChange: (v) => set("width", Number.isNaN(v) ? null : v)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Min width (px)",
          value: col.min_width,
          onChange: (v) => set("min_width", Number.isNaN(v) ? 60 : v)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Max width (px)",
          value: col.max_width ?? void 0,
          onChange: (v) => set("max_width", Number.isNaN(v) ? null : v)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "col.formatting", title: "Formatting & behavior", children: [
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Cell type",
          value: col.cell_type ?? "text",
          disabled: isCustomColumn,
          options: CELL_TYPES.map((t) => ({ value: t, label: t })),
          onChange: (v) => set("cell_type", v)
        }
      ),
      /* @__PURE__ */ jsx(
        TextRow,
        {
          label: "Format string",
          value: col.format_string ?? "",
          disabled: isCustomColumn,
          placeholder: ".3f",
          onChange: (v) => set("format_string", v || null),
          help: /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
            /* @__PURE__ */ jsxs("p", { children: [
              "Only applies when Cell type is ",
              /* @__PURE__ */ jsx("strong", { children: "number" }),
              ". Accepted tokens:"
            ] }),
            /* @__PURE__ */ jsxs("ul", { className: "list-disc pl-3.5 space-y-0.5", children: [
              /* @__PURE__ */ jsxs("li", { children: [
                /* @__PURE__ */ jsx("code", { children: ".3f" }),
                " / ",
                /* @__PURE__ */ jsx("code", { children: "0.000" }),
                " — 3 decimals (e.g. ",
                /* @__PURE__ */ jsx("code", { children: ".300" }),
                ")"
              ] }),
              /* @__PURE__ */ jsxs("li", { children: [
                /* @__PURE__ */ jsx("code", { children: ".2f" }),
                " / ",
                /* @__PURE__ */ jsx("code", { children: "0.00" }),
                " — 2 decimals (e.g. ",
                /* @__PURE__ */ jsx("code", { children: "1.25" }),
                ")"
              ] }),
              /* @__PURE__ */ jsxs("li", { children: [
                /* @__PURE__ */ jsx("code", { children: ".1f" }),
                " / ",
                /* @__PURE__ */ jsx("code", { children: "0.0" }),
                " — 1 decimal (e.g. ",
                /* @__PURE__ */ jsx("code", { children: "6.1" }),
                ")"
              ] }),
              /* @__PURE__ */ jsxs("li", { children: [
                "anything else / blank — rounds to an integer ",
                /* @__PURE__ */ jsx("strong", { children: "with" }),
                " a thousands separator (e.g. ",
                /* @__PURE__ */ jsx("code", { children: "2,026" }),
                ")"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              "There is no number token for a plain, ungrouped integer. For IDs, years, or codes (e.g. ",
              /* @__PURE__ */ jsx("code", { children: "2026" }),
              ", not ",
              /* @__PURE__ */ jsx("code", { children: "2,026" }),
              "), set Cell type to",
              /* @__PURE__ */ jsx("strong", { children: " text" }),
              " instead and leave this blank."
            ] }),
            /* @__PURE__ */ jsxs("p", { children: [
              "For currency (e.g. ",
              /* @__PURE__ */ jsx("code", { children: "$1,234.56" }),
              "), set Cell type to",
              /* @__PURE__ */ jsx("strong", { children: " currency" }),
              " — this field is ignored."
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ jsx(
        TextRow,
        {
          label: "Null display",
          value: col.null_display ?? "—",
          disabled: isCustomColumn,
          onChange: (v) => set("null_display", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Aggregate function",
          value: col.aggregate_function ?? "",
          disabled: isCustomColumn,
          options: AGG_FNS.map((a) => ({ value: a, label: a || "— none —" })),
          onChange: (v) => set("aggregate_function", v || null)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Link target",
          value: col.link_target ?? "",
          disabled: isCustomColumn,
          options: LINK_TARGETS.map((a) => ({ value: a, label: a || "— none —" })),
          onChange: (v) => set("link_target", v || null)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "col.colors", title: "Colors & gradient", children: [
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Sort ascending",
          value: col.sort_asc_color,
          disabled: isCustomColumn,
          onChange: (v) => set("sort_asc_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Sort descending",
          value: col.sort_desc_color,
          disabled: isCustomColumn,
          onChange: (v) => set("sort_desc_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Gradient from",
          value: col.gradient_from_color,
          disabled: isCustomColumn,
          onChange: (v) => set("gradient_from_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Gradient to",
          value: col.gradient_to_color,
          disabled: isCustomColumn,
          onChange: (v) => set("gradient_to_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        TextAreaRow,
        {
          label: "Conditional format (JSON)",
          value: col.conditional_format ?? "",
          disabled: isCustomColumn,
          placeholder: '[{"op":"gte","value":0.9,"color":"emerald"}]',
          onChange: (v) => set("conditional_format", v || null)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "col.behavior",
        title: "Column behavior",
        subtitle: "Pinning, filtering, resizing, and grouping (all config-driven).",
        children: [
          /* @__PURE__ */ jsx(
            SelectRow,
            {
              label: "Pinned",
              value: col.pinned ?? "",
              options: [
                { value: "", label: "— none —" },
                { value: "left", label: "Left" },
                { value: "right", label: "Right" }
              ],
              onChange: (v) => set("pinned", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Allow filter",
              checked: bool(col.allow_filter),
              disabled: isCustomColumn,
              onChange: (v) => set("allow_filter", v)
            }
          ),
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Default filter (JSON or literal)",
              value: col.default_filter ?? "",
              disabled: isCustomColumn,
              placeholder: '"MLB" or {"op":"gte","value":10}',
              onChange: (v) => set("default_filter", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Resizable",
              checked: bool(col.resizable),
              onChange: (v) => set("resizable", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Group by",
              checked: bool(col.group_by),
              disabled: isCustomColumn,
              onChange: (v) => set("group_by", v)
            }
          ),
          bool(col.group_by) && /* @__PURE__ */ jsx("p", { className: "px-1 text-[11px] text-muted-foreground", children: "Rows collapse under this column. Pagination is suspended while grouping is active so aggregate counts stay accurate." }),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Wrap text (column override)",
              checked: bool(col.wrap_text),
              disabled: isCustomColumn,
              onChange: (v) => set("wrap_text", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Editable (inline editor)",
              checked: bool(col.editable),
              disabled: isCustomColumn,
              onChange: (v) => set("editable", v)
            }
          ),
          bool(col.editable) && /* @__PURE__ */ jsxs("p", { className: "px-1 text-[11px] text-muted-foreground", children: [
            "Cells become double-click editors when the host grid supplies an ",
            /* @__PURE__ */ jsx("code", { children: "onCellCommit" }),
            " handler. Grid-level",
            " ",
            /* @__PURE__ */ jsx("code", { children: "read_only" }),
            " disables editing across every column regardless of this flag."
          ] })
        ]
      }
    )
  ] });
}
export {
  GridColumnsPanel as default
};
//# sourceMappingURL=GridColumnsPanel.js.map
