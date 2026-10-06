import { useCallback, useReducer } from "react";
import {
  applyDrafts,
  isDirty as isDraftsDirty,
  type BulkDrafts,
  type DraftWrite,
} from "./bulkDraftStore";

export const HISTORY_LIMIT = 50;

export interface DraftHistory {
  drafts: BulkDrafts;
  past: BulkDrafts[];
  future: BulkDrafts[];
}

export type DraftHistoryAction =
  | { type: "write"; writes: DraftWrite[] }
  | { type: "replace"; drafts: BulkDrafts }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

export function draftHistoryReducer(
  state: DraftHistory,
  action: DraftHistoryAction
): DraftHistory {
  switch (action.type) {
    case "write": {
      const nextDrafts = applyDrafts(state.drafts, action.writes);
      // No-op check: if next state is identical, do not consume an undo slot
      if (JSON.stringify(nextDrafts) === JSON.stringify(state.drafts)) {
        return state;
      }
      return {
        drafts: nextDrafts,
        past: [...state.past.slice(-Math.max(0, HISTORY_LIMIT - 1)), state.drafts],
        future: [],
      };
    }

    case "replace": {
      if (JSON.stringify(action.drafts) === JSON.stringify(state.drafts)) {
        return state;
      }
      return {
        drafts: action.drafts,
        past: [...state.past.slice(-Math.max(0, HISTORY_LIMIT - 1)), state.drafts],
        future: [],
      };
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        drafts: previous,
        past: state.past.slice(0, -1),
        future: [state.drafts, ...state.future],
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        drafts: next,
        past: [...state.past, state.drafts],
        future: state.future.slice(1),
      };
    }

    case "reset":
      return {
        drafts: {},
        past: [],
        future: [],
      };

    default:
      return state;
  }
}

export function useDraftHistory(initialDrafts: BulkDrafts = {}) {
  const [state, dispatch] = useReducer(draftHistoryReducer, {
    drafts: initialDrafts,
    past: [],
    future: [],
  });

  const write = useCallback((writes: DraftWrite[]) => {
    dispatch({ type: "write", writes });
  }, []);

  const replace = useCallback((drafts: BulkDrafts) => {
    dispatch({ type: "replace", drafts });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    drafts: state.drafts,
    draftsOverride: {
      drafts: state.drafts,
      onChange: replace,
    },
    isDirty: isDraftsDirty(state.drafts),
    write,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  };
}
