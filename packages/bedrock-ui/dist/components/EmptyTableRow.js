import { jsx } from "react/jsx-runtime";
import { TableRow, TableCell } from "./ui/table.js";
import { GridStatusContent } from "./GridStatus.js";
function EmptyTableRow({ colSpan, message }) {
  return /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan, className: "p-0", children: /* @__PURE__ */ jsx(
    GridStatusContent,
    {
      type: "empty",
      message: message ?? "No data matches the current filters."
    }
  ) }) });
}
export {
  EmptyTableRow
};
//# sourceMappingURL=EmptyTableRow.js.map
