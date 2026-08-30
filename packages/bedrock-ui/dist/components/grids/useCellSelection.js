import { useState, useRef, useMemo, useCallback, useEffect } from "react";
function escapeTsvValue(value) {
  if (!/[\t\n\r"]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
function toTsv(matrix) {
  return matrix.map((row) => row.map(escapeTsvValue).join("	")).join("\n");
}
function parseTsv(text) {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (normalized === "") return [[""]];
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (quoted) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === "	") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}
function seedForKey(key, modified) {
  if (modified) return void 0;
  if (key === "Enter" || key === " " || key === "F2") return null;
  if (key === "Backspace" || key === "Delete") return "";
  return key.length === 1 ? key : void 0;
}
function isEditingActiveElement() {
  const el = typeof document === "undefined" ? null : document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable === true;
}
function rectangle(rowKeys, columnIds, anchor, focus) {
  const r1 = rowKeys.indexOf(anchor.rowKey);
  const r2 = rowKeys.indexOf(focus.rowKey);
  const c1 = columnIds.indexOf(anchor.columnId);
  const c2 = columnIds.indexOf(focus.columnId);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
  return {
    rowKeys: rowKeys.slice(Math.min(r1, r2), Math.max(r1, r2) + 1),
    columnIds: columnIds.slice(Math.min(c1, c2), Math.max(c1, c2) + 1),
    anchor,
    focus
  };
}
function useCellSelection({
  enabled,
  rowKeys,
  columnIds,
  getCellText,
  onCopy,
  onPaste,
  onFill,
  onBeginEdit
}) {
  const [anchor, setAnchor] = useState(null);
  const [focus, setFocus] = useState(null);
  const [fillTo, setFillTo] = useState(null);
  const dragRef = useRef(null);
  const stateRef = useRef({ anchor, focus, rowKeys, columnIds, getCellText });
  stateRef.current = { anchor, focus, rowKeys, columnIds, getCellText };
  const handlersRef = useRef({ onCopy, onPaste, onFill, onBeginEdit });
  handlersRef.current = { onCopy, onPaste, onFill, onBeginEdit };
  const range = useMemo(
    () => anchor && focus ? rectangle(rowKeys, columnIds, anchor, focus) : null,
    [anchor, focus, rowKeys, columnIds]
  );
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const clear = useCallback(() => {
    setAnchor(null);
    setFocus(null);
    setFillTo(null);
  }, []);
  useEffect(() => {
    if (!enabled) {
      if (anchor || focus) clear();
      return;
    }
    if (!focus) return;
    if (!rowKeys.includes(focus.rowKey) || !columnIds.includes(focus.columnId)) {
      clear();
    }
  }, [enabled, focus, anchor, rowKeys, columnIds, clear]);
  const onCellMouseDown = useCallback(
    (rowKey, columnId, event) => {
      if (!enabled || event.button !== 0) return;
      setFillTo(null);
      if (event.shiftKey && stateRef.current.anchor) {
        setFocus({ rowKey, columnId });
      } else {
        setAnchor({ rowKey, columnId });
        setFocus({ rowKey, columnId });
      }
      dragRef.current = "range";
    },
    [enabled]
  );
  const onCellMouseEnter = useCallback(
    (rowKey, columnId) => {
      if (!enabled) return;
      if (dragRef.current === "range") setFocus({ rowKey, columnId });
      else if (dragRef.current === "fill") setFillTo(rowKey);
    },
    [enabled]
  );
  const onCellDoubleClick = useCallback(
    (rowKey, columnId) => {
      if (!enabled) return;
      setAnchor({ rowKey, columnId });
      setFocus({ rowKey, columnId });
      handlersRef.current.onBeginEdit?.({ rowKey, columnId }, null);
    },
    [enabled]
  );
  const onFillHandleMouseDown = useCallback(
    (event) => {
      if (!enabled) return;
      event.stopPropagation();
      event.preventDefault();
      dragRef.current = "fill";
    },
    [enabled]
  );
  useEffect(() => {
    if (!enabled) return;
    const onMouseUp = () => {
      const mode = dragRef.current;
      dragRef.current = null;
      if (mode !== "fill") return;
      const source = rangeRef.current;
      const to = fillTo;
      setFillTo(null);
      if (!source || !to) return;
      const { rowKeys: keys } = stateRef.current;
      const last = source.rowKeys[source.rowKeys.length - 1];
      const from = keys.indexOf(last);
      const target = keys.indexOf(to);
      if (from < 0 || target <= from) return;
      handlersRef.current.onFill?.({
        source,
        target: {
          rowKeys: keys.slice(from + 1, target + 1),
          columnIds: source.columnIds,
          anchor: { rowKey: keys[from + 1], columnId: source.columnIds[0] },
          focus: {
            rowKey: keys[target],
            columnId: source.columnIds[source.columnIds.length - 1]
          }
        }
      });
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [enabled, fillTo]);
  const rangeTsv = useCallback((current) => {
    const { getCellText: read } = stateRef.current;
    return toTsv(
      current.rowKeys.map(
        (rowKey) => current.columnIds.map((columnId) => read(rowKey, columnId))
      )
    );
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const move = (rowStep, colStep, extend, toEdge) => {
      const { focus: currentFocus, rowKeys: keys, columnIds: cols } = stateRef.current;
      if (!currentFocus) return;
      const r = keys.indexOf(currentFocus.rowKey);
      const c = cols.indexOf(currentFocus.columnId);
      if (r < 0 || c < 0) return;
      const nextRow = toEdge && rowStep !== 0 ? rowStep < 0 ? 0 : keys.length - 1 : Math.min(Math.max(r + rowStep, 0), keys.length - 1);
      const nextCol = toEdge && colStep !== 0 ? colStep < 0 ? 0 : cols.length - 1 : Math.min(Math.max(c + colStep, 0), cols.length - 1);
      const next = { rowKey: keys[nextRow], columnId: cols[nextCol] };
      setFocus(next);
      if (!extend) setAnchor(next);
    };
    const onKeyDown = (event) => {
      if (isEditingActiveElement()) return;
      const mod = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") {
        if (stateRef.current.focus) clear();
        return;
      }
      if (mod && (event.key === "a" || event.key === "A")) {
        const { rowKeys: keys, columnIds: cols } = stateRef.current;
        if (!stateRef.current.focus || keys.length === 0 || cols.length === 0) return;
        event.preventDefault();
        setAnchor({ rowKey: keys[0], columnId: cols[0] });
        setFocus({
          rowKey: keys[keys.length - 1],
          columnId: cols[cols.length - 1]
        });
        return;
      }
      const steps = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1]
      };
      const step = steps[event.key];
      if (step && stateRef.current.focus) {
        event.preventDefault();
        move(step[0], step[1], event.shiftKey, mod);
        return;
      }
      const focusCell = stateRef.current.focus;
      const beginEdit = handlersRef.current.onBeginEdit;
      if (focusCell && beginEdit && event.key !== "Tab") {
        const seed = seedForKey(event.key, mod || event.altKey);
        if (seed !== void 0 && beginEdit(focusCell, seed) === true) {
          event.preventDefault();
          return;
        }
      }
      if ((event.key === "Tab" || event.key === "Enter") && stateRef.current.focus) {
        event.preventDefault();
        if (event.key === "Tab") move(0, event.shiftKey ? -1 : 1, false, false);
        else move(event.shiftKey ? -1 : 1, 0, false, false);
      }
    };
    const onCopyEvent = (event) => {
      if (isEditingActiveElement()) return;
      const current = rangeRef.current;
      if (!current) return;
      const tsv = rangeTsv(current);
      if (event.clipboardData) {
        event.preventDefault();
        event.clipboardData.setData("text/plain", tsv);
      } else {
        void navigator.clipboard?.writeText?.(tsv)?.catch?.(() => {
        });
      }
      handlersRef.current.onCopy?.(tsv, current);
    };
    const onPasteEvent = (event) => {
      if (isEditingActiveElement()) return;
      const current = rangeRef.current;
      const handler = handlersRef.current.onPaste;
      if (!current || !handler) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (text === "") return;
      event.preventDefault();
      const anchorCell = {
        rowKey: current.rowKeys[0],
        columnId: current.columnIds[0]
      };
      const matrix = parseTsv(text);
      const { rowKeys: keys, columnIds: cols } = stateRef.current;
      const rowStart = keys.indexOf(anchorCell.rowKey);
      const colStart = cols.indexOf(anchorCell.columnId);
      if (rowStart < 0 || colStart < 0) return;
      const width = matrix.reduce((widest, row) => Math.max(widest, row.length), 0);
      handler({
        anchor: anchorCell,
        matrix,
        rowKeys: keys.slice(rowStart, rowStart + matrix.length),
        columnIds: cols.slice(colStart, colStart + width)
      });
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopyEvent);
    document.addEventListener("paste", onPasteEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopyEvent);
      document.removeEventListener("paste", onPasteEvent);
    };
  }, [enabled, clear, rangeTsv]);
  const selectedRows = useMemo(
    () => new Set(range?.rowKeys ?? []),
    [range]
  );
  const selectedCols = useMemo(
    () => new Set(range?.columnIds ?? []),
    [range]
  );
  const fillRows = useMemo(() => {
    if (!range || !fillTo) return /* @__PURE__ */ new Set();
    const last = range.rowKeys[range.rowKeys.length - 1];
    const from = rowKeys.indexOf(last);
    const to = rowKeys.indexOf(fillTo);
    if (from < 0 || to <= from) return /* @__PURE__ */ new Set();
    return new Set(rowKeys.slice(from + 1, to + 1));
  }, [range, fillTo, rowKeys]);
  return {
    enabled,
    anchor,
    focus,
    range,
    isFocused: useCallback(
      (rowKey, columnId) => focus?.rowKey === rowKey && focus?.columnId === columnId,
      [focus]
    ),
    isSelected: useCallback(
      (rowKey, columnId) => selectedRows.has(rowKey) && selectedCols.has(columnId),
      [selectedRows, selectedCols]
    ),
    isFillPreview: useCallback(
      (rowKey, columnId) => fillRows.has(rowKey) && selectedCols.has(columnId),
      [fillRows, selectedCols]
    ),
    isFillOrigin: useCallback(
      (rowKey, columnId) => !!range && range.rowKeys[range.rowKeys.length - 1] === rowKey && range.columnIds[range.columnIds.length - 1] === columnId,
      [range]
    ),
    onCellMouseDown,
    onCellMouseEnter,
    onCellDoubleClick,
    onFillHandleMouseDown,
    clear
  };
}
export {
  useCellSelection as default,
  parseTsv,
  seedForKey,
  toTsv,
  useCellSelection
};
//# sourceMappingURL=useCellSelection.js.map
