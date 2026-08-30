import { jsxs, jsx } from "react/jsx-runtime";
import { Skeleton } from "./ui/skeleton.js";
function PageSkeleton({ rows = 8 }) {
  return /* @__PURE__ */ jsxs("div", { "data-testid": "page-skeleton", className: "space-y-4 animate-in fade-in duration-150", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-2", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-7 w-64" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-96" })
      ] }),
      /* @__PURE__ */ jsx(Skeleton, { className: "h-9 w-32" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3", children: Array.from({ length: 4 }).map((_, i) => /* @__PURE__ */ jsx(Skeleton, { className: "h-20 w-full" }, i)) }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-2 rounded-md border border-border bg-card/40 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-40" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-24" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-5 w-24 ml-auto" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-px w-full bg-border/60" }),
      Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 py-1", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-1/3" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-1/6" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-1/6" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-1/6 ml-auto" })
      ] }, i))
    ] })
  ] });
}
export {
  PageSkeleton as default
};
//# sourceMappingURL=PageSkeleton.js.map
