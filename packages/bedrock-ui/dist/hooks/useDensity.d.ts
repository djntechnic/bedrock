export type Density = "compact" | "standard" | "comfortable";
export declare const DENSITY_CELL_PAD: Record<Density, string>;
/**
 * Estimated rendered row height (px) per density. Consumed by virtualized grids
 * (e.g. PlayerGrid) as the `estimateSize` value so the virtualizer reserves the
 * correct scroll height. Values approximate the cell vertical padding above plus
 * a single line of text (~20px) and the 1px row border.
 */
export declare const DENSITY_ROW_HEIGHT: Record<Density, number>;
export declare const DENSITY_LABEL: Record<Density, string>;
/**
 * Manages in-page row density for a grid. The admin denseMode setting provides
 * the initial value; the user can cycle through Compact / Standard / Comfortable
 * for the session without persisting to admin config.
 */
export declare function useDensity(denseMode: boolean): {
    density: Density;
    cellPad: string;
    cycleDensity: () => void;
};
