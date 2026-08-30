/**
 * @file GridEditor.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Redesigned admin Grid Editor. Two-pane workspace:
 *              • Header — Screen + Grid selects, dirty indicator, Save/Cancel,
 *                Focus-mode toggle.
 *              • Left panel — collapsible (w-[360px] ↔ w-12), three shadcn Tabs:
 *                Grid Settings, Custom Columns (rank/selection/rank highlight),
 *                Column Settings.
 *              • Preview canvas — the live GridPreview.
 *
 *              Focus mode wraps the preview in a full-viewport shadcn Dialog
 *              with a slide-over Sheet for on-demand settings access.
 *
 *              All state transitions are instrumented through @/utils/logger so
 *              a support engineer can retrace an admin's session end-to-end.
 */
interface GridEditorProps {
    /** Seed the initial grid selection. Testing/deep-link hook; optional. */
    initialGridId?: string | null;
}
export default function GridEditor({ initialGridId }?: GridEditorProps): import("react").JSX.Element;
export {};
