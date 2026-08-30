/**
 * @file GridFocusMode.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Full-viewport focus mode. Wraps <GridPreview> in a shadcn Dialog
 *              (size-full override) and exposes an INLINE right-side settings
 *              panel that is collapsible, pinnable and resizeable — replacing
 *              the older modal Sheet drawer that dimmed/blurred the live
 *              preview whenever an admin opened it.
 *
 *              Panel state (open/pinned/width) is persisted to localStorage so
 *              opening focus mode restores the admin's last layout. Every
 *              transition emits a structured Pino log so support can
 *              reconstruct the admin's session from the log stream.
 *
 *              Keyboard: `Esc` exits focus mode when the panel is pinned; when
 *              unpinned it collapses the panel first, then a second `Esc` exits.
 */
import type { GridDraft } from "./useGridDraft";
interface GridFocusModeProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: GridDraft;
    gridId: string;
    gridLabel?: string;
}
export default function GridFocusMode({ open, onOpenChange, draft, gridId, gridLabel, }: GridFocusModeProps): import("react").JSX.Element;
export {};
