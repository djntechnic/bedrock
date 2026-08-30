import { useMemo, useState, useRef, useEffect } from "react";
import { useGridSettings, useGridColumns, useUpdateGridSetting, useUpdateGridColumn, useCreateGridColumn, useDeleteGridColumn } from "../../../hooks/useAdminPlatform.js";
import { buildGridConfig } from "../../../hooks/useGridConfig.js";
import { log } from "../../../utils/logger.js";
function diffFields(base, next, keys) {
  const out = {};
  for (const k of keys) {
    if (!base || base[k] !== next[k]) out[k] = next[k];
  }
  return out;
}
function defaultColumnSeed(columnId, nextOrder) {
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
    gradient_to_color: null
  };
}
function useGridDraft(gridId) {
  const { data: gridsData } = useGridSettings();
  const { data: colsData } = useGridColumns(gridId);
  const updateGrid = useUpdateGridSetting();
  const updateColumn = useUpdateGridColumn();
  const createColumn = useCreateGridColumn();
  const deleteColumn = useDeleteGridColumn();
  const serverGrid = useMemo(
    () => gridsData?.data?.find((g) => g.grid_id === gridId),
    [gridsData, gridId]
  );
  const serverColumns = useMemo(() => colsData?.data ?? [], [colsData]);
  const isLoaded = gridId !== null && gridsData !== void 0 && colsData !== void 0;
  const [draftGrid, setDraftGrid] = useState(null);
  const [draftColumns, setDraftColumns] = useState([]);
  const [lifecycle, setLifecycle] = useState({});
  const baselineRef = useRef({
    columns: []
  });
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
      columns: serverColumns
    };
  }, [gridId, serverGrid, serverColumns, isLoaded]);
  const draftConfig = useMemo(() => {
    if (!gridId || !draftGrid) return null;
    const visibleCols = draftColumns.filter(
      (c) => lifecycle[c.column_id] !== "delete"
    );
    return buildGridConfig(gridId, draftGrid, visibleCols, true);
  }, [gridId, draftGrid, draftColumns, lifecycle]);
  const isDirty = useMemo(() => {
    const base = baselineRef.current;
    if (!draftGrid || !base.grid) return false;
    const gridKeys = Object.keys(draftGrid);
    if (gridKeys.some((k) => draftGrid[k] !== base.grid[k])) return true;
    if (Object.values(lifecycle).some((v) => v !== "existing")) return true;
    for (const col of draftColumns) {
      const baseCol = base.columns.find((c) => c.column_id === col.column_id);
      if (!baseCol) return true;
      const colKeys = Object.keys(col);
      if (colKeys.some((k) => col[k] !== baseCol[k])) return true;
    }
    return false;
  }, [draftGrid, draftColumns, lifecycle]);
  function setGridField(field, value) {
    setDraftGrid((prev) => prev ? { ...prev, [field]: value } : prev);
    log.debug({ gridId, field, action: "edit" }, "GridEditor: grid field edited");
  }
  function setColumnField(columnId, field, value) {
    setDraftColumns(
      (prev) => prev.map((c) => c.column_id === columnId ? { ...c, [field]: value } : c)
    );
    log.debug(
      { gridId, columnId, field, action: "edit" },
      "GridEditor: column field edited"
    );
  }
  function reorderColumns(nextOrder) {
    setDraftColumns((prev) => {
      const bool = (v) => typeof v === "boolean" ? v : v === 1;
      const maxOrder = prev.reduce((m, c) => Math.max(m, c.column_order ?? 0), 0);
      const existingMap = new Map(prev.map((c) => [c.column_id, c]));
      const fullList = [];
      for (const id of nextOrder) {
        if (existingMap.has(id)) {
          fullList.push(existingMap.get(id));
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
            group_by: false
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
            group_by: false
          });
        }
      }
      const named = new Set(nextOrder);
      const trailing = prev.filter((c) => !named.has(c.column_id)).sort((a, b) => a.column_order - b.column_order);
      const merged = [...fullList, ...trailing];
      return merged.map((c, idx) => ({ ...c, column_order: idx }));
    });
    log.info(
      { gridId, action: "reorder", columnCount: nextOrder.length },
      "GridEditor: columns reordered"
    );
  }
  function insertColumn(seed) {
    const columnId = seed.column_id;
    if (!columnId) return;
    setDraftColumns((prev) => {
      if (prev.some((c) => c.column_id === columnId)) return prev;
      const nextOrder = prev.reduce((max, c) => Math.max(max, c.column_order ?? 0), 0) + 1;
      return [...prev, { ...defaultColumnSeed(columnId, nextOrder), ...seed }];
    });
    setLifecycle((prev) => ({ ...prev, [columnId]: "insert" }));
    log.info(
      { gridId, columnId, action: "column.insert" },
      "GridEditor: column inserted"
    );
  }
  function removeColumn(columnId) {
    setLifecycle((prev) => {
      const current = prev[columnId] ?? "existing";
      if (current === "insert") {
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
      "GridEditor: column removed"
    );
  }
  function columnLifecycle(columnId) {
    return lifecycle[columnId] ?? "existing";
  }
  function applyImportedConfig(payload) {
    if (!draftGrid) return;
    const { grid: importedGrid, columns: importedColumns } = payload;
    const identityFields = /* @__PURE__ */ new Set([
      "grid_setting_id",
      "grid_id",
      "grid_label"
    ]);
    setDraftGrid((prev) => {
      if (!prev) return prev;
      const merged = { ...prev };
      for (const key of Object.keys(importedGrid)) {
        if (identityFields.has(key)) continue;
        merged[key] = importedGrid[key];
      }
      return merged;
    });
    const importedIds = new Set(importedColumns.map((c) => c.column_id));
    const currentIds = new Set(draftColumns.map((c) => c.column_id));
    for (const importedCol of importedColumns) {
      const columnId = importedCol.column_id;
      if (!currentIds.has(columnId)) {
        insertColumn({ ...importedCol });
      } else {
        for (const key of Object.keys(importedCol)) {
          if (key === "column_setting_id" || key === "grid_setting_id" || key === "column_id") continue;
          setColumnField(columnId, key, importedCol[key]);
        }
      }
    }
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
        columnCount: importedColumns.length
      },
      "GridEditor: imported JSON applied to draft"
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
      Object.keys(draftGrid)
    );
    delete gridDiff.grid_setting_id;
    delete gridDiff.grid_id;
    delete gridDiff.grid_label;
    const inserts = [];
    const updates = [];
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
        Object.keys(col)
      );
      delete diff.column_setting_id;
      delete diff.grid_setting_id;
      delete diff.column_id;
      if (Object.keys(diff).length > 0) {
        updates.push({ columnId: col.column_id, diff });
      }
    }
    const deletes = Object.entries(lifecycle).filter(([, stage]) => stage === "delete").map(([columnId]) => columnId);
    log.info(
      {
        gridId,
        action: "save",
        changedGridFields: Object.keys(gridDiff),
        insertedColumns: inserts.map((c) => c.column_id),
        updatedColumns: updates.map((d) => d.columnId),
        removedColumns: deletes
      },
      "GridEditor: saving draft"
    );
    if (Object.keys(gridDiff).length > 0) {
      await updateGrid.mutateAsync({ gridId, updates: gridDiff });
    }
    for (const col of inserts) {
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
    isSaving: updateGrid.isPending || updateColumn.isPending || createColumn.isPending || deleteColumn.isPending
  };
}
export {
  useGridDraft
};
//# sourceMappingURL=useGridDraft.js.map
