import { useState, useEffect } from "react";
const DENSITY_CELL_PAD = {
  compact: "px-2 py-0.5",
  standard: "px-2 py-1.5",
  comfortable: "px-3 py-2.5"
};
const DENSITY_ROW_HEIGHT = {
  compact: 25,
  standard: 33,
  comfortable: 41
};
const DENSITY_LABEL = {
  compact: "Compact",
  standard: "Standard",
  comfortable: "Comfortable"
};
const DENSITY_CYCLE = ["compact", "standard", "comfortable"];
function useDensity(denseMode) {
  const [density, setDensity] = useState(denseMode ? "compact" : "standard");
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
    cycleDensity
  };
}
export {
  DENSITY_CELL_PAD,
  DENSITY_LABEL,
  DENSITY_ROW_HEIGHT,
  useDensity
};
//# sourceMappingURL=useDensity.js.map
