import { jsx, Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils.js";
import { Input } from "../ui/input.js";
import { Switch } from "../ui/switch.js";
import { seedForKey } from "./useCellSelection.js";
function coerceForCellType(value, cellType) {
  if (cellType === "number") {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`"${value}" is not a valid number`);
    }
    return parsed;
  }
  return value;
}
function EditableCell({
  children,
  rawValue,
  cellType,
  disabled = false,
  openWith = null,
  onEditingChange,
  onCommit
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => stringify(rawValue));
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef(null);
  const seededRef = useRef(null);
  useEffect(() => {
    if (editing) {
      if (seededRef.current === null) setDraft(stringify(rawValue));
      else seededRef.current = null;
    }
  }, [editing, rawValue]);
  useEffect(() => {
    if (!editing) return;
    onEditingChange?.(true);
    return () => onEditingChange?.(false);
  }, [editing]);
  const inputMountRef = useCallback((node) => {
    inputRef.current = node;
    if (!node) return;
    node.focus();
    const seed = seededRef.current;
    if (seed === null) node.select();
    else node.setSelectionRange(seed.length, seed.length);
  }, []);
  const activate = useCallback(
    (seed) => {
      if (disabled || committing) return;
      if (seed != null) {
        seededRef.current = seed;
        setDraft(seed);
      }
      setEditing(true);
    },
    [disabled, committing]
  );
  const lastNonceRef = useRef(null);
  useEffect(() => {
    if (!openWith) {
      lastNonceRef.current = null;
      return;
    }
    if (lastNonceRef.current === openWith.nonce) return;
    lastNonceRef.current = openWith.nonce;
    activate(openWith.seed ?? null);
  }, [openWith, activate]);
  const cancel = useCallback(() => {
    seededRef.current = null;
    setEditing(false);
    setDraft(stringify(rawValue));
  }, [rawValue]);
  const commit = useCallback(async () => {
    if (committing) return;
    const rawInput = inputRef.current?.value ?? draft;
    let coerced;
    try {
      coerced = coerceForCellType(rawInput, cellType);
    } catch (err) {
      toast.error("Invalid value", {
        description: err instanceof Error ? err.message : String(err)
      });
      return;
    }
    if (coerced === rawValue || stringify(coerced) === stringify(rawValue)) {
      setEditing(false);
      return;
    }
    setCommitting(true);
    try {
      await onCommit(coerced);
      setEditing(false);
    } catch (err) {
      toast.error("Could not save change", {
        description: err instanceof Error ? err.message : String(err)
      });
      setDraft(stringify(rawValue));
    } finally {
      setCommitting(false);
    }
  }, [committing, draft, cellType, rawValue, onCommit]);
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel]
  );
  const onIdleKeyDown = useCallback(
    (e) => {
      if (disabled) return;
      const seed = seedForKey(e.key, e.ctrlKey || e.metaKey || e.altKey);
      if (seed === void 0) return;
      e.preventDefault();
      activate(seed);
    },
    [activate, disabled]
  );
  if (disabled) {
    return /* @__PURE__ */ jsx(Fragment, { children });
  }
  if (cellType === "boolean") {
    const isOn = rawValue === 1 || rawValue === true;
    const onToggle = async (next) => {
      if (committing) return;
      const nextInt = next ? 1 : 0;
      if (nextInt === (isOn ? 1 : 0)) return;
      setCommitting(true);
      try {
        await onCommit(nextInt);
      } catch (err) {
        toast.error("Could not save change", {
          description: err instanceof Error ? err.message : String(err)
        });
      } finally {
        setCommitting(false);
      }
    };
    return /* @__PURE__ */ jsx(
      Switch,
      {
        checked: isOn,
        disabled: committing,
        onCheckedChange: (next) => void onToggle(next),
        "aria-label": "Toggle value"
      }
    );
  }
  if (!editing) {
    return /* @__PURE__ */ jsx(
      "span",
      {
        role: "button",
        tabIndex: 0,
        onDoubleClick: () => activate(),
        onKeyDown: onIdleKeyDown,
        "aria-label": "Double-click or type to edit",
        className: cn(
          "inline-block cursor-text -mx-1 px-1 rounded",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        ),
        children
      }
    );
  }
  return /* @__PURE__ */ jsx(
    Input,
    {
      ref: inputMountRef,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: () => void commit(),
      onKeyDown,
      disabled: committing,
      "aria-label": "Edit cell value",
      inputMode: cellType === "number" ? "decimal" : void 0,
      className: "h-6 py-0 px-1 text-xs"
    }
  );
}
function stringify(v) {
  if (v === null || v === void 0) return "";
  return String(v);
}
export {
  EditableCell as default
};
//# sourceMappingURL=EditableCell.js.map
