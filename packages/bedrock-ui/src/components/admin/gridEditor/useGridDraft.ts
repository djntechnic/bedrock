/**
 * @file useGridDraft.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Draft-state engine for the admin Grid Editor. Loads the server
 *              grid + column settings, holds an editable working copy, exposes
 *              field setters, dirty tracking, reset, and a diffed save that fires
 *              the existing PATCH mutations. A live GridConfig is derived from the
 *              draft via the shared buildGridConfig() so the preview renders the
 *              exact runtime mapping — no drift from production grids.
 *
 *              Phase 6A: the draft tracks a `columnLifecycle` map so the
 *              editor can insert and remove columns in the draft and reconcile
 *              them on Save via POST/DELETE mutations alongside the existing
 *              PATCH path. Phase 6C adds `applyImportedConfig` — a bulk setter
 *              that routes an imported JSON snapshot through the same
 *              insert/update/remove primitives so the diff summary the admin
 *              approves in the import dialog matches what save() actually
 *              writes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGridSettings,
  useGridColumns,
  useUpdateGridSetting,
  useUpdateGridColumn,
  useCreateGridColumn,
  useDeleteGridColumn,
  type GridSetting,
  type GridColumnSetting,
} from "../../../hooks/useAdminPlatform";
import { buildGridConfig, type GridConfig } from "../../../hooks/useGridConfig";
import { log } from "../../../utils/logger";
import type { GridConfigExport } from "./exportGridConfig";

/** Lifecycle state a draft column carries across insert/update/delete flows. */
export type ColumnLifecycle = "existing" | "insert" | "delete";

export interface GridDraft {
  /** The editable grid-level settings, or null before a grid is selected/loaded. */
  draftGrid: GridSetting | null;
  /** The editable column-level settings. */
  draftColumns: GridColumnSetting[];
  /** Live GridConfig derived from the draft, for the preview. */
  draftConfig: GridConfig | null;
  /** Whether the draft differs from the last-loaded server state. */
  isDirty: boolean;
  /** Whether the server data has resolved. */
  isLoaded: boolean;
  /** Mutate a single grid-level field. */
  setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
  /** Mutate a single column-level field. */
  setColumnField: <K extends keyof GridColumnSetting>(
    columnId: string,
    field: K,
    value: GridColumnSetting[K],
  ) => void;
  /**
   * Phase 5: renumber every draft column's `column_order` to its index in
   * `nextOrder`. Columns not named in `nextOrder` retain their existing
   * order relative to each other, appended after the reordered set — a
   * safety net for when the caller only reorders the visible subset.
   */
  reorderColumns: (nextOrder: string[]) => void;
  /**
   * Phase 6A: append a new column to the draft with sensible defaults. The
   * lifecycle map flags it as `"insert"` so `save()` fires a POST rather
   * than a PATCH. A caller may pre-fill any writable field via `seed`.
   */
  insertColumn: (seed: Partial<GridColumnSetting> & { column_id: string }) => void;
  /**
   * Phase 6A: retire a column from the draft. Existing rows are marked
   * `"delete"` and remain visible in the draft (so the diff summary still
   * shows them until save clears them); rows still in `"insert"` state
   * are dropped outright since they never hit the server.
   */
  removeColumn: (columnId: string) => void;
  /** Read the current lifecycle state for a column (defaults to "existing"). */
  columnLifecycle: (columnId: string) => ColumnLifecycle;
  /**
   * Phase 6C: apply an imported JSON snapshot on top of the current draft.
   * Grid-identity fields (`grid_id`, `grid_setting_id`, `grid_label`) and
   * per-column identity (`column_setting_id`, `grid_setting_id`) are
   * ignored so imports never rebrand the open grid.
   */
  applyImportedConfig: (payload: GridConfigExport) => void;
  /** Revert the draft to the last-loaded server state. */
  reset: () => void;
  /** Persist only changed fields via PATCH. Resolves when all writes complete. */
  save: () => Promise<void>;
  /** True while a save is in flight. */
  isSaving: boolean;
}

/** Shallow field-level diff of two records, returning only changed keys. */
function diffFields<T>(
  base: T | undefined,
  next: T,
  keys: (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (!base || base[k] !== next[k]) out[k] = next[k];
  }
  return out;
}

/** Sensible defaults applied to newly inserted draft columns. Mirrors the
 *  admin editor's "empty column" baseline so a fresh row renders without
 *  the admin having to touch every switch. */
function defaultColumnSeed(
  columnId: string,
  nextOrder: number,
): GridColumnSetting {
  return {
    column_setting_id: 0,
    grid_setting_id: 0,
    column_id: columnId,
    label_override: null,
    tooltip_override: null,
    default_visible: true,
    default_sort: null,
    default_filter: null,
    column_order: nextOrder,
    format_string: null,
    null_display: null,
    allow_sort: true,
    allow_sort_mode: "both",
    allow_filter: false,
    read_only: false,
    width: null,
    min_width: null,
    max_width: null,
    pinned: null,
    text_align: null,
    wrap_text: false,
    resizable: false,
    cell_type: null,
    aggregate_function: null,
    conditional_format: null,
    link_target: null,
    group_by: false,
    sort_asc_color: null,
    sort_desc_color: null,
    gradient_from_color: null,
    gradient_to_color: null,
  } as unknown as GridColumnSetting;
}

export function useGridDraft(gridId: string | null): GridDraft {
  const { data: gridsData } = useGridSettings();
  const { data: colsData } = useGridColumns(gridId);
  const updateGrid = useUpdateGridSetting();
  const updateColumn = useUpdateGridColumn();
  const createColumn = useCreateGridColumn();
  const deleteColumn = useDeleteGridColumn();

  const serverGrid = useMemo(
    () => gridsData?.data?.find((g) => g.grid_id === gridId),
    [gridsData, gridId],
  );
  const serverColumns = useMemo(() => colsData?.data ?? [], [colsData]);
  const isLoaded =
    gridId !== null && gridsData !== undefined && colsData !== undefined;

  const [draftGrid, setDraftGrid] = useState<GridSetting | null>(null);
  const [draftColumns, setDraftColumns] = useState<GridColumnSetting[]>([]);
  const [lifecycle, setLifecycle] = useState<Record<string, ColumnLifecycle>>({});
  // Baseline the draft was seeded from — the diff/dirty reference.
  const baselineRef = useRef<{ grid?: GridSetting; columns: GridColumnSetting[] }>({
    columns: [],
  });

  // (Re)seed the draft whenever the selected grid or its freshly-fetched server
  // data changes. Keyed on gridId + server object identity so an external
  // invalidation (e.g. after save) re-baselines cleanly.
  useEffect(() => {
    if (!isLoaded || !serverGrid) {
      setDraftGrid(null);
      setDraftColumns([]);
      setLifecycle({});
      baselineRef.current = { columns: [] };
      return;
    }
    setDraftGrid({ ...serverGrid });
    setDraftColumns(serverColumns.map((c) => ({ ...c })));
    setLifecycle({});
    baselineRef.current = {
      grid: serverGrid,
      columns: serverColumns,
    };
  }, [gridId, serverGrid, serverColumns, isLoaded]);

  const draftConfig = useMemo(() => {
    if (!gridId || !draftGrid) return null;
    // Filter deleted columns out of the preview surface — the admin has
    // asked to retire them, so previewing them would misrepresent the
    // save outcome.
    const visibleCols = draftColumns.filter(
      (c) => lifecycle[c.column_id] !== "delete",
    );
    return buildGridConfig(gridId, draftGrid, visibleCols, true);
  }, [gridId, draftGrid, draftColumns, lifecycle]);

  const isDirty = useMemo(() => {
    const base = baselineRef.current;
    if (!draftGrid || !base.grid) return false;
    const gridKeys = Object.keys(draftGrid) as (keyof GridSetting)[];
    if (gridKeys.some((k) => draftGrid[k] !== base.grid![k])) return true;
    // Any pending insert / delete counts as dirty even if the row values
    // themselves match a baseline entry that never existed / still exists.
    if (Object.values(lifecycle).some((v) => v !== "existing")) return true;
    for (const col of draftColumns) {
      const baseCol = base.columns.find((c) => c.column_id === col.column_id);
      if (!baseCol) return true;
      const colKeys = Object.keys(col) as (keyof GridColumnSetting)[];
      if (colKeys.some((k) => col[k] !== baseCol[k])) return true;
    }
    return false;
  }, [draftGrid, draftColumns, lifecycle]);

  function setGridField<K extends keyof GridSetting>(field: K, value: GridSetting[K]) {
    setDraftGrid((prev) => (prev ? { ...prev, [field]: value } : prev));
    log.debug({ gridId, field, action: "edit" }, "GridEditor: grid field edited");
  }

  function setColumnField<K extends keyof GridColumnSetting>(
    columnId: string,
    field: K,
    value: GridColumnSetting[K],
  ) {
    setDraftColumns((prev) =>
      prev.map((c) => (c.column_id === columnId ? { ...c, [field]: value } : c)),
    );
    log.debug(
      { gridId, columnId, field, action: "edit" },
      "GridEditor: column field edited",
    );
  }

  function reorderColumns(nextOrder: string[]) {
    setDraftColumns((prev) => {
      const bool = (v: unknown): boolean =>
        typeof v === "boolean" ? v : v === 1;
      const maxOrder = prev.reduce((m, c) => Math.max(m, c.column_order ?? 0), 0);
      const existingMap = new Map(prev.map((c) => [c.column_id, c]));

      const fullList: GridColumnSetting[] = [];
      for (const id of nextOrder) {
        if (existingMap.has(id)) {
          fullList.push(existingMap.get(id)!);
        } else if (id === "ranking" && bool(draftGrid?.show_ranking)) {
          fullList.push({
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
        } else if (id === "_compare" && bool(draftGrid?.allow_selection)) {
          fullList.push({
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
      }

      const named = new Set(nextOrder);
      const trailing = prev
        .filter((c) => !named.has(c.column_id))
        .sort((a, b) => a.column_order - b.column_order);
      const merged = [...fullList, ...trailing];
      return merged.map((c, idx) => ({ ...c, column_order: idx }));
    });
    log.info(
      { gridId, action: "reorder", columnCount: nextOrder.length },
      "GridEditor: columns reordered",
    );
  }

  function insertColumn(
    seed: Partial<GridColumnSetting> & { column_id: string },
  ) {
    const columnId = seed.column_id;
    if (!columnId) return;
    setDraftColumns((prev) => {
      // Prevent silent duplicates — if the caller re-inserts an existing
      // column id, no-op (the caller should catch this via columnLifecycle).
      if (prev.some((c) => c.column_id === columnId)) return prev;
      const nextOrder =
        prev.reduce((max, c) => Math.max(max, c.column_order ?? 0), 0) + 1;
      return [...prev, { ...defaultColumnSeed(columnId, nextOrder), ...seed }];
    });
    setLifecycle((prev) => ({ ...prev, [columnId]: "insert" }));
    log.info(
      { gridId, columnId, action: "column.insert" },
      "GridEditor: column inserted",
    );
  }

  function removeColumn(columnId: string) {
    setLifecycle((prev) => {
      const current = prev[columnId] ?? "existing";
      if (current === "insert") {
        // Never hit the server; drop from the draft entirely below.
        const { [columnId]: _dropped, ...rest } = prev;
        return rest;
      }
      return { ...prev, [columnId]: "delete" };
    });
    setDraftColumns((prev) => {
      const current = lifecycle[columnId] ?? "existing";
      if (current === "insert") {
        return prev.filter((c) => c.column_id !== columnId);
      }
      return prev;
    });
    log.info(
      { gridId, columnId, action: "column.remove" },
      "GridEditor: column removed",
    );
  }

  function columnLifecycle(columnId: string): ColumnLifecycle {
    return lifecycle[columnId] ?? "existing";
  }

  function applyImportedConfig(payload: GridConfigExport) {
    if (!draftGrid) return;
    const { grid: importedGrid, columns: importedColumns } = payload;

    // 1. Grid-level fields: merge everything except identity.
    const identityFields = new Set<keyof GridSetting>([
      "grid_setting_id" as keyof GridSetting,
      "grid_id" as keyof GridSetting,
      "grid_label" as keyof GridSetting,
    ]);
    setDraftGrid((prev) => {
      if (!prev) return prev;
      const merged = { ...prev } as unknown as Record<string, unknown>;
      for (const key of Object.keys(importedGrid) as (keyof GridSetting)[]) {
        if (identityFields.has(key)) continue;
        merged[key as string] = importedGrid[key] as unknown;
      }
      return merged as unknown as GridSetting;
    });

    // 2. Columns: reconcile against the current draft. Existing ids
    //    → merge fields via setColumnField loop; new ids → insertColumn;
    //    ids missing from the payload but present in the baseline →
    //    removeColumn (respecting the lifecycle state machine).
    const importedIds = new Set(importedColumns.map((c) => c.column_id));
    const currentIds = new Set(draftColumns.map((c) => c.column_id));

    // Additions + updates.
    for (const importedCol of importedColumns) {
      const columnId = importedCol.column_id;
      if (!currentIds.has(columnId)) {
        insertColumn({ ...importedCol });
      } else {
        for (const key of Object.keys(importedCol) as (keyof GridColumnSetting)[]) {
          if (
            key === "column_setting_id" ||
            key === "grid_setting_id" ||
            key === "column_id"
          ) continue;
          setColumnField(columnId, key, importedCol[key]);
        }
      }
    }

    // Removals: anything in the current draft that the payload didn't name.
    for (const draftCol of draftColumns) {
      if (!importedIds.has(draftCol.column_id)) {
        removeColumn(draftCol.column_id);
      }
    }

    log.info(
      {
        gridId,
        action: "import.apply",
        exportVersion: payload.exportVersion,
        columnCount: importedColumns.length,
      },
      "GridEditor: imported JSON applied to draft",
    );
  }

  function reset() {
    const base = baselineRef.current;
    setDraftGrid(base.grid ? { ...base.grid } : null);
    setDraftColumns(base.columns.map((c) => ({ ...c })));
    setLifecycle({});
    log.info({ gridId, action: "cancel" }, "GridEditor: draft reverted");
  }

  async function save() {
    if (!gridId || !draftGrid) return;
    const base = baselineRef.current;
    const gridDiff = diffFields(
      base.grid,
      draftGrid,
      Object.keys(draftGrid) as (keyof GridSetting)[],
    );
    // Never PATCH identity columns.
    delete gridDiff.grid_setting_id;
    delete gridDiff.grid_id;
    delete gridDiff.grid_label;

    // Split the columns into inserts / updates / deletes so we can
    // sequence the right mutation for each. The (grid_setting_id,
    // column_id) uniqueness invariant means insert-then-delete of the
    // same id is well-defined; we still run in [create, update, delete]
    // order for a safe reload after Save.
    const inserts: GridColumnSetting[] = [];
    const updates: { columnId: string; diff: Partial<GridColumnSetting> }[] = [];

    for (const col of draftColumns) {
      const stage = lifecycle[col.column_id] ?? "existing";
      if (stage === "delete") continue;
      if (stage === "insert") {
        inserts.push(col);
        continue;
      }
      const baseCol = base.columns.find((c) => c.column_id === col.column_id);
      const diff = diffFields(
        baseCol,
        col,
        Object.keys(col) as (keyof GridColumnSetting)[],
      );
      delete diff.column_setting_id;
      delete diff.grid_setting_id;
      delete diff.column_id;
      if (Object.keys(diff).length > 0) {
        updates.push({ columnId: col.column_id, diff });
      }
    }

    const deletes = Object.entries(lifecycle)
      .filter(([, stage]) => stage === "delete")
      .map(([columnId]) => columnId);

    log.info(
      {
        gridId,
        action: "save",
        changedGridFields: Object.keys(gridDiff),
        insertedColumns: inserts.map((c) => c.column_id),
        updatedColumns: updates.map((d) => d.columnId),
        removedColumns: deletes,
      },
      "GridEditor: saving draft",
    );

    if (Object.keys(gridDiff).length > 0) {
      await updateGrid.mutateAsync({ gridId, updates: gridDiff });
    }
    // 1. Creates first so subsequent PATCHes and DELETEs land on rows the
    //    server knows about.
    for (const col of inserts) {
      // Strip client-only fields so the payload matches the whitelist —
      // identity fields are backfilled by the service.
      const {
        column_setting_id: _csi,
        grid_setting_id: _gsi,
        ...seed
      } = col;
      await createColumn.mutateAsync({ gridId, seed });
    }
    for (const { columnId, diff } of updates) {
      await updateColumn.mutateAsync({ gridId, columnId, updates: diff });
    }
    for (const columnId of deletes) {
      await deleteColumn.mutateAsync({ gridId, columnId });
    }
  }

  return {
    draftGrid,
    draftColumns,
    draftConfig,
    isDirty,
    isLoaded,
    setGridField,
    setColumnField,
    reorderColumns,
    insertColumn,
    removeColumn,
    columnLifecycle,
    applyImportedConfig,
    reset,
    save,
    isSaving:
      updateGrid.isPending ||
      updateColumn.isPending ||
      createColumn.isPending ||
      deleteColumn.isPending,
  };
}
