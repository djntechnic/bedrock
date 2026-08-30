import { jsx, jsxs } from "react/jsx-runtime";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "./ui/skeleton.js";
function GridStatusContent({ type, message }) {
  if (type === "loading") {
    return /* @__PURE__ */ jsx("div", { className: "space-y-2 p-4", children: Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-32" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-10" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-10" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-12 ml-auto" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-12" }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-3.5 w-10" })
    ] }, i)) });
  }
  if (type === "error") {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 py-12 text-destructive", children: [
      /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center", children: /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5" }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium", children: message ?? "Something went wrong." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 py-12 text-muted-foreground", children: [
    /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-muted flex items-center justify-center", children: /* @__PURE__ */ jsx(Inbox, { className: "h-5 w-5" }) }),
    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: message ?? "No results found." }),
    /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "Try adjusting your filters." })
  ] });
}
function GridStatusRow({
  type,
  message,
  colSpan = 1
}) {
  return /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan, children: /* @__PURE__ */ jsx(GridStatusContent, { type, message }) }) });
}
export {
  GridStatusContent,
  GridStatusRow
};
//# sourceMappingURL=GridStatus.js.map
