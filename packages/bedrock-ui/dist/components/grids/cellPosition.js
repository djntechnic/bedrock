function cellPositionClasses(pinnedSide, isNameCol, isCellSelectable) {
  if (pinnedSide === "left" || pinnedSide === "right") {
    return "sticky z-10 bg-card";
  }
  if (isNameCol) return "sticky left-0 z-10 bg-card";
  return isCellSelectable ? "relative" : "";
}
export {
  cellPositionClasses
};
//# sourceMappingURL=cellPosition.js.map
