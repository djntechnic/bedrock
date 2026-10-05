export declare const RAIL_COLLAPSED_KEY = "bedrock_workbench_rail_collapsed";
export interface WorkbenchRail {
    collapsed: boolean;
    toggle: () => void;
    /** False under `prefers-reduced-motion`: the width transition is dropped. */
    animate: boolean;
}
export declare function useWorkbenchRail(): WorkbenchRail;
