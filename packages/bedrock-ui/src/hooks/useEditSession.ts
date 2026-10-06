import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { log } from "../utils/logger";
import { useEditSessionStore } from "../store/editSessionStore";

export type EditSessionStatus = "idle" | "saving" | "saved" | "error";

export interface UseEditSessionOptions {
  dirty: boolean;
  onSave: () => Promise<void> | void;
  onBeforeSave?: () => boolean | Promise<boolean>;
  onCancel?: () => void;
  guardNavigation?: boolean;
  saveShortcut?: boolean;
}

export interface EditSession {
  dirty: boolean;
  saving: boolean;
  status: EditSessionStatus;
  error: unknown;
  save: () => Promise<boolean>;
  cancel: () => void;
  guard: (action: () => void) => void;
}

export function useEditSession({
  dirty,
  onSave,
  onBeforeSave,
  onCancel,
  guardNavigation = true,
  saveShortcut = false,
}: UseEditSessionOptions): EditSession {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"none" | "saved" | "error">("none");
  const [error, setError] = useState<unknown>(null);
  const inFlight = useRef(false);

  const latest = useRef({ dirty, onSave, onBeforeSave, onCancel });
  latest.current = { dirty, onSave, onBeforeSave, onCancel };

  const save = useCallback(async (): Promise<boolean> => {
    if (!latest.current.dirty || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError(null);

    try {
      const allowed = (await latest.current.onBeforeSave?.()) ?? true;
      if (!allowed) {
        return false;
      }
      await latest.current.onSave();
      setOutcome("saved");
      return true;
    } catch (err) {
      setError(err);
      setOutcome("error");
      log.error({ err, action: "editSession.save.error" }, "useEditSession: save failed");
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  const cancel = useCallback(() => {
    setError(null);
    setOutcome("none");
    latest.current.onCancel?.();
  }, []);

  const guard = useCallback(
    (action: () => void) => {
      if (latest.current.dirty) {
        useEditSessionStore.getState().requestLeave(action);
      } else {
        action();
      }
    },
    []
  );

  useEffect(() => {
    if (dirty && guardNavigation) {
      const store = useEditSessionStore.getState();
      store.register(id, () => latest.current.onCancel?.());

      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        store.unregister(id);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [dirty, guardNavigation, id]);

  useEffect(() => {
    if (!saveShortcut) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveShortcut, save]);

  const status: EditSessionStatus = saving
    ? "saving"
    : outcome === "error"
      ? "error"
      : outcome === "saved" && !dirty
        ? "saved"
        : "idle";

  return useMemo(
    () => ({
      dirty,
      saving,
      status,
      error,
      save,
      cancel,
      guard,
    }),
    [dirty, saving, status, error, save, cancel, guard]
  );
}
