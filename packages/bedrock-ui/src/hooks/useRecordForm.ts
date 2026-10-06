import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditSession, type EditSession } from "./useEditSession";

export interface UseRecordFormOptions<T extends object> {
  initialValues: T;
  onSave: (values: T) => Promise<void> | void;
  onBeforeSave?: (values: T) => boolean | Promise<boolean>;
  autosave?: boolean;
  autosaveDelayMs?: number;
  maxHistory?: number;
}

export interface RecordForm<T extends object> {
  values: T;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: Date | null;
  session: EditSession;
}

interface FormState<T> {
  baseline: T;
  values: T;
  past: T[];
  future: T[];
}

export function useRecordForm<T extends object>({
  initialValues,
  onSave,
  onBeforeSave,
  autosave = false,
  autosaveDelayMs = 600,
  maxHistory = 10,
}: UseRecordFormOptions<T>): RecordForm<T> {
  const [state, setState] = useState<FormState<T>>(() => ({
    baseline: initialValues,
    values: initialValues,
    past: [],
    future: [],
  }));
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const handlers = useRef({ onSave, onBeforeSave });
  handlers.current = { onSave, onBeforeSave };

  const initialKey = useMemo(() => JSON.stringify(initialValues), [initialValues]);
  const seenKey = useRef(initialKey);

  useEffect(() => {
    if (seenKey.current !== initialKey) {
      seenKey.current = initialKey;
      setState({
        baseline: initialValues,
        values: initialValues,
        past: [],
        future: [],
      });
    }
  }, [initialKey, initialValues]);

  const isDirty = useMemo(() => {
    return JSON.stringify(state.values) !== JSON.stringify(state.baseline);
  }, [state.values, state.baseline]);

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setState((prev) => {
        if (Object.is(prev.values[field], value)) return prev;
        const nextValues = { ...prev.values, [field]: value };
        const nextPast = [...prev.past.slice(-Math.max(0, maxHistory - 1)), prev.values];
        return {
          ...prev,
          values: nextValues,
          past: nextPast,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        ...prev,
        values: previous,
        past: prev.past.slice(0, -1),
        future: [prev.values, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        ...prev,
        values: next,
        past: [...prev.past, prev.values],
        future: prev.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      values: prev.baseline,
      past: [],
      future: [],
    }));
  }, []);

  const persist = useCallback(async () => {
    const currentValues = stateRef.current.values;
    await handlers.current.onSave(currentValues);
    setState((prev) => ({
      baseline: currentValues,
      values: prev.values,
      past: [],
      future: [],
    }));
    setLastSavedAt(new Date());
  }, []);

  const session = useEditSession({
    dirty: isDirty,
    onSave: persist,
    onBeforeSave: () => handlers.current.onBeforeSave?.(stateRef.current.values) ?? true,
    onCancel: reset,
    saveShortcut: true,
  });

  useEffect(() => {
    if (!autosave || !isDirty || session.saving) return;
    const timer = window.setTimeout(() => {
      void session.save();
    }, autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [autosave, isDirty, session, autosaveDelayMs]);

  return {
    values: state.values,
    setFieldValue,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    lastSavedAt,
    session,
  };
}
