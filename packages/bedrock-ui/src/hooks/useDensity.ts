/**
 * @file useDensity.ts
 * @module frontend/src/hooks
 * @description Hook exposing the grid density (compact/normal) preference.
 */
import { useState, useEffect } from "react";

export type Density = "compact" | "standard" | "comfortable";

export const DENSITY_CELL_PAD: Record<Density, string> = {
  compact: "px-2 py-0.5",
  standard: "px-2 py-1.5",
  comfortable: "px-3 py-2.5",
};

/**
 * Estimated rendered row height (px) per density. Consumed by virtualized grids
 * (e.g. PlayerGrid) as the `estimateSize` value so the virtualizer reserves the
 * correct scroll height. Values approximate the cell vertical padding above plus
 * a single line of text (~20px) and the 1px row border.
 */
export const DENSITY_ROW_HEIGHT: Record<Density, number> = {
  compact: 25,
  standard: 33,
  comfortable: 41,
};

export const DENSITY_LABEL: Record<Density, string> = {
  compact: "Compact",
  standard: "Standard",
  comfortable: "Comfortable",
};

const DENSITY_CYCLE: Density[] = ["compact", "standard", "comfortable"];

/**
 * Manages in-page row density for a grid. The admin denseMode setting provides
 * the initial value; the user can cycle through Compact / Standard / Comfortable
 * for the session without persisting to admin config.
 */
export function useDensity(denseMode: boolean) {
  const [density, setDensity] = useState<Density>(denseMode ? "compact" : "standard");

  useEffect(() => {
    setDensity(denseMode ? "compact" : "standard");
  }, [denseMode]);

  function cycleDensity() {
    setDensity((prev) => {
      const idx = DENSITY_CYCLE.indexOf(prev);
      return DENSITY_CYCLE[(idx + 1) % DENSITY_CYCLE.length];
    });
  }

  return {
    density,
    cellPad: DENSITY_CELL_PAD[density],
    cycleDensity,
  };
}
