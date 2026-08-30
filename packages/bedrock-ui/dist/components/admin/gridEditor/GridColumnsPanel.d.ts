/**
 * @file GridColumnsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Column-level settings editor (app_grid_column_settings). A column
 *              picker drives a single-column detail form; each configuration
 *              group is a persisted CollapsibleSection so an admin can focus on
 *              one aspect at a time. Phase 7 F2 retired the "Bucket-④ stubs"
 *              section: `pinned`, `allow_filter`, `default_filter`, `resizable`,
 *              and `group_by` now all round-trip into a live `<DataGrid>`
 *              consumer via TanStack column pinning / filtering / resizing /
 *              grouping (see DataGrid.tsx columnPinning / columnFilters memos).
 *
 *              Phase 6A adds column-level CRUD: an "+ Add column" dialog that
 *              picks from the dataset schema registry (Phase 6B) OR takes a
 *              custom id, and a per-column "Remove" trash button gated on the
 *              editor's `read_only` flag. Both go through the shared draft
 *              lifecycle map so Save reconciles inserts and deletes alongside
 *              the existing PATCH diff.
 */
import type { GridColumnSetting, GridSetting } from "../../../hooks/useAdminPlatform";
import type { ColumnLifecycle } from "./useGridDraft";
interface GridColumnsPanelProps {
    draftColumns: GridColumnSetting[];
    draftGrid?: GridSetting | null;
    setColumnField: <K extends keyof GridColumnSetting>(columnId: string, field: K, value: GridColumnSetting[K]) => void;
    /** Phase 6A — the grid whose columns are being edited. Drives dataset schema lookup. */
    gridId?: string | null;
    /** Phase 6A — draft insert; when omitted, the "+ Add column" button hides. */
    insertColumn?: (seed: Partial<GridColumnSetting> & {
        column_id: string;
    }) => void;
    /** Phase 6A — draft remove; when omitted, the trash button hides. */
    removeColumn?: (columnId: string) => void;
    /** Phase 6A — lifecycle lookup so the panel can badge insert/delete state. */
    columnLifecycle?: (columnId: string) => ColumnLifecycle;
}
export default function GridColumnsPanel({ draftColumns, draftGrid, setColumnField, gridId, insertColumn, removeColumn, columnLifecycle, }: GridColumnsPanelProps): import("react").JSX.Element;
export {};
