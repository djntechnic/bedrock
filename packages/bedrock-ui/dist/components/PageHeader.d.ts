/**
 * @file PageHeader.tsx
 * @module frontend/src/components
 * @description Standard page header with title, description, and action slot.
 */
import type { ReactNode } from "react";
interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    badge?: ReactNode;
    meta?: ReactNode;
    breadcrumbs?: ReactNode;
    className?: string;
    /**
     * Pin the header — title, subtitle, actions and the rule — to the top of the
     * nearest scroll container, so scrolling a long grid does not scroll away the
     * page's identity and its action buttons.
     *
     * Opt-in rather than the default: `position: sticky` only does anything
     * inside a scroll container, and every host that lays its page out
     * differently would silently reflow if this were switched on for them. A
     * host adopts it one screen at a time.
     *
     * The opaque background and the negative-margin bleed are not decoration —
     * without them the rows scrolling underneath show through the gap between
     * the header's padding and its parent's, which reads as a rendering fault.
     */
    sticky?: boolean;
}
export default function PageHeader({ title, subtitle, actions, badge, meta, breadcrumbs, className, sticky }: PageHeaderProps): import("react").JSX.Element;
export {};
