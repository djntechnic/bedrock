/**
 * @file GridSettingsPanel.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Grid-level settings editor (app_grid_settings). Every card is a
 *              persisted CollapsibleSection so admins can focus on one group at
 *              a time; open/close state persists to localStorage. Phase 7 F1
 *              retired the legacy "Not yet wired" section — every field on this
 *              panel now round-trips into a live `<DataGrid>` display consumer
 *              (sticky_first_column plumbs into TanStack column pinning; the
 *              rest were wired in prior phases).
 */
import type { GridSetting } from "../../../hooks/useAdminPlatform";
interface GridSettingsPanelProps {
    draftGrid: GridSetting;
    columnIds: string[];
    setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
}
export default function GridSettingsPanel({ draftGrid, columnIds, setGridField, }: GridSettingsPanelProps): import("react").JSX.Element;
export {};
