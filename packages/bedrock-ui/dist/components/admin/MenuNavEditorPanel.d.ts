import React from "react";
export interface FlatNavItem {
    nav_key: string;
    parent_key: string | null;
    label: string;
    group_label: string | null;
    icon?: import('react').ComponentType<{
        className?: string;
    }>;
    default_sort_order: number;
    is_sub_item: boolean;
    is_spacer: boolean;
    is_custom?: boolean;
}
export default function MenuNavEditorPanel(): React.JSX.Element;
