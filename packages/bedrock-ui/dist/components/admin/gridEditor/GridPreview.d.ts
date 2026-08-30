/**
 * @file GridPreview.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Live, config-driven preview for the admin Grid Editor. Renders a
 *              real TanStack Table over 1–10 staged rows using the SAME shared
 *              primitives as production grids (applyColumnSizing, prependRankColumn,
 *              prependSelectionColumn, resolveCell, gradients, GridHeader,
 *              SortableTableHead) so what the admin sees equals what saving yields.
 *
 *              Preview-only authoring aids (dataset variant, viewport, row-count,
 *              detailed roster editor) live in a bottom-anchored collapsible
 *              drawer + a dedicated "Manage preview data" modal. Their state is
 *              never persisted.
 */
import type { GridConfig } from "../../../hooks/useGridConfig";
interface GridPreviewProps {
    config: GridConfig;
    /**
     * Optional handler that opens the full-viewport focus mode. When provided, a
     * `⛶` button appears in the preview toolbar. Rendered inside focus mode the
     * outer parent passes `undefined` to hide the button (already in focus).
     */
    onEnterFocus?: () => void;
    /**
     * Phase 5: fired when the admin drags a header to a new position. The
     * Grid Editor wires this to `useGridDraft.reorderColumns` so `column_order`
     * on the draft columns is renumbered live and the change is persisted on
     * Save. When omitted, reorder is session-local (state lives on the preview).
     */
    onColumnReorder?: (nextOrder: string[]) => void;
}
export default function GridPreview({ config, onEnterFocus: _onEnterFocus, onColumnReorder }: GridPreviewProps): import("react").JSX.Element;
export {};
