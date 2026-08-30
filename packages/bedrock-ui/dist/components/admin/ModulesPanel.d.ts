export interface ModuleItem {
    module_id: number;
    slug: string;
    label: string;
    description: string | null;
    sort_order: number;
    is_core: boolean;
}
export default function ModulesPanel(): import("react").JSX.Element;
