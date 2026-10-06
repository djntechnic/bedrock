import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GridEditor from "./GridEditor";
import { useEditSessionStore, hasDirtySessions } from "../../../store/editSessionStore";

const mockDraft = vi.hoisted(() => ({
  isDirty: false,
  isLoaded: true,
  isSaving: false,
  draftGrid: { grid_id: "test-grid" },
  draftColumns: [] as { column_id: string }[],
  draftConfig: { gridId: "test-grid" },
  save: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
  setGridField: vi.fn(),
  setColumnField: vi.fn(),
  reorderColumns: vi.fn(),
  insertColumn: vi.fn(),
  removeColumn: vi.fn(),
  columnLifecycle: {},
  applyImportedConfig: vi.fn(),
}));

vi.mock("./useGridDraft", () => ({
  useGridDraft: () => mockDraft,
}));

vi.mock("../../../hooks/useAdminPlatform", () => ({
  useGridSettings: () => ({
    data: { data: [{ grid_id: "test-grid", grid_label: "Test Grid", page: "items" }] },
    isLoading: false,
  }),
  useGridPages: () => ({
    data: { data: ["items"] },
  }),
}));

vi.mock("./GridPreview", () => ({ default: () => <div data-testid="preview" /> }));
vi.mock("./GridSettingsPanel", () => ({ default: () => null }));
vi.mock("./GridColumnsPanel", () => ({ default: () => null }));
vi.mock("./CustomColumnsPanel", () => ({ default: () => null }));
vi.mock("./GridFocusMode", () => ({ default: () => null }));
vi.mock("./ImportGridConfigDialog", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../utils/logger", () => ({ log: { info: vi.fn(), error: vi.fn() } }));

describe("GridEditor with useEditSession", () => {
  it("renders SaveBar and manages editSessionStore registration", async () => {
    mockDraft.isDirty = false;
    const { rerender } = render(<GridEditor initialGridId="test-grid" />);

    expect(screen.getByTestId("save-bar")).toBeDefined();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);

    mockDraft.isDirty = true;
    rerender(<GridEditor initialGridId="test-grid" />);
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    await waitFor(() => expect(mockDraft.save).toHaveBeenCalled());
  });

  it("Cancel discards the draft through the session", () => {
    mockDraft.isDirty = true;
    render(<GridEditor initialGridId="test-grid" />);

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(mockDraft.reset).toHaveBeenCalled();
  });

  it("Ctrl+S saves via the session shortcut", async () => {
    mockDraft.save.mockClear();
    mockDraft.isDirty = true;
    render(<GridEditor initialGridId="test-grid" />);

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await waitFor(() => expect(mockDraft.save).toHaveBeenCalledTimes(1));
  });
});
