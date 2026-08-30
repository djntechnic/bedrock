/**
 * @file ImportGridConfigDialog.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Phase 6C — modal that accepts a GridConfigExport JSON payload
 *              (file upload or paste), previews the resulting diff against
 *              the current draft (added / removed / changed columns +
 *              grid-level field diffs + dataset warnings), and applies the
 *              payload to the draft on confirm. The admin still has to Save
 *              to persist — the dialog only stages changes.
 */
import type { GridSetting, GridColumnSetting } from "../../../hooks/useAdminPlatform";
import type { GridConfigExport } from "./exportGridConfig";
interface ImportGridConfigDialogProps {
    gridId: string | null;
    draftGrid: GridSetting | null;
    draftColumns: GridColumnSetting[];
    onApply: (payload: GridConfigExport) => void;
    /** Optional external opener — the dialog also renders its own trigger button. */
    disabled?: boolean;
}
export default function ImportGridConfigDialog({ gridId, draftGrid, draftColumns, onApply, disabled, }: ImportGridConfigDialogProps): import("react").JSX.Element;
export {};
