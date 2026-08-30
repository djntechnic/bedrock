/**
 * @file CustomColumnsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description "Custom Columns" tab — surfaces the grid-injected meta columns
 *              (Selection, Ranking, Rank highlight) that are **not** rows in
 *              app_grid_column_settings but are still governed by
 *              app_grid_settings flags. Each toggle writes the draft, so the
 *              live preview updates immediately.
 *
 *              Field mapping (already-existing GridSetting fields, no schema
 *              changes):
 *                • Selection column   → allow_selection
 *                • Ranking column     → show_ranking
 *                • Rank highlight     → show_rank_highlight
 *              Related header affordance (visibility of the rank-highlight
 *              toolbar toggle on the live grid header) is not a separate flag
 *              today — the same show_rank_highlight field drives both. Kept
 *              explicit in the copy so admins understand the paired behavior.
 */
import type { GridSetting } from "../../../hooks/useAdminPlatform";
interface CustomColumnsPanelProps {
    draftGrid: GridSetting;
    setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
}
export default function CustomColumnsPanel({ draftGrid, setGridField, }: CustomColumnsPanelProps): import("react").JSX.Element;
export {};
