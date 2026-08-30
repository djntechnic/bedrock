/**
 * @file PageToolbar.tsx
 * @module frontend/src/components
 * @description Shared page-level toolbar shell. Provides the consistent
 * bordered, blurred filter/action bar wrapper used above data views (filters,
 * league toggles, search). Standardizes spacing, wrapping and surface styling so
 * pages never re-implement toolbar chrome.
 */
import { type ReactNode } from "react";
/** Props for {@link PageToolbar}. */
interface PageToolbarProps {
    /** Toolbar content — typically filter controls and action buttons. */
    children: ReactNode;
    /** Extra classes merged onto the toolbar container. */
    className?: string;
    /** When true, prevents wrapping and allows horizontal scrolling (e.g. TrendDeltaPage). */
    noWrap?: boolean;
}
/**
 * Renders the standardized page toolbar surface.
 *
 * @param props - See {@link PageToolbarProps}.
 * @returns The toolbar container wrapping `children`.
 */
export default function PageToolbar({ children, className, noWrap }: PageToolbarProps): import("react").JSX.Element;
export {};
