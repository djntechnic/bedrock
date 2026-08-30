/**
 * @file CollapsibleSection.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Reusable Card + Collapsible + persisted-disclosure wrapper. Every
 *              editor panel and sub-card uses this so open/close state is
 *              uniform, keyboard-accessible, and observable in logs.
 *
 *              Accepts an optional `badge` (e.g. an "N changed" dirty indicator)
 *              rendered next to the title so admins can see per-section state
 *              without expanding.
 */
import * as React from "react";
interface CollapsibleSectionProps {
    /** localStorage key suffix — final key is `mlbtracker.gridEditor.<storageKey>`. */
    storageKey: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Optional right-side badge (e.g. dirty count, warning). */
    badge?: React.ReactNode;
    defaultOpen?: boolean;
    /** Render the outer `<Card>`. Set false when nested inside another Card. */
    boxed?: boolean;
    className?: string;
    contentClassName?: string;
    children: React.ReactNode;
}
export default function CollapsibleSection({ storageKey, title, subtitle, badge, defaultOpen, boxed, className, contentClassName, children, }: CollapsibleSectionProps): React.JSX.Element;
export {};
