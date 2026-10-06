import { create } from "zustand";

export interface EditSessionStore {
  sessions: Record<string, () => void>;
  pendingLeave: (() => void) | null;
  register: (id: string, onDiscard: () => void) => void;
  unregister: (id: string) => void;
  requestLeave: (action: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export const useEditSessionStore = create<EditSessionStore>((set, get) => ({
  sessions: {},
  pendingLeave: null,

  register: (id, onDiscard) => {
    set((state) => ({
      sessions: { ...state.sessions, [id]: onDiscard },
    }));
  },

  unregister: (id) => {
    set((state) => {
      const rest = Object.fromEntries(
        Object.entries(state.sessions).filter(([key]) => key !== id)
      );
      return {
        sessions: rest,
        pendingLeave: Object.keys(rest).length === 0 ? null : state.pendingLeave,
      };
    });
  },

  requestLeave: (action) => {
    const { sessions } = get();
    if (Object.keys(sessions).length === 0) {
      action();
    } else {
      set({ pendingLeave: action });
    }
  },

  confirmLeave: () => {
    const { sessions, pendingLeave } = get();
    set({ sessions: {}, pendingLeave: null });
    Object.values(sessions).forEach((discard) => {
      try {
        discard();
      } catch {
        // Safe discard
      }
    });
    pendingLeave?.();
  },

  cancelLeave: () => {
    set({ pendingLeave: null });
  },
}));

export const hasDirtySessions = (state: EditSessionStore) =>
  Object.keys(state.sessions).length > 0;
