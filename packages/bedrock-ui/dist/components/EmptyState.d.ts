/**
 * @file EmptyState.tsx
 * @module frontend/src/components
 * @description Reusable empty-state placeholder for grids and lists with no data.
 */
import { type LucideIcon } from "lucide-react";
interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}
export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps): import("react").JSX.Element;
export {};
