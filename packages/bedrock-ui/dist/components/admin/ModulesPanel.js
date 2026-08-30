import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client.js";
import { API_ROUTES } from "../../api/routes.js";
import { queryKeys } from "../../hooks/queryKeys.js";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../ui/table.js";
import { Input } from "../ui/input.js";
import { Badge } from "../ui/badge.js";
import { Skeleton } from "../ui/skeleton.js";
import { Search } from "lucide-react";
function ModulesPanel() {
  const [search, setSearch] = useState("");
  const { data: modules = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.modules.list(),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.modules.list()
      );
      return data;
    }
  });
  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const q = search.toLowerCase();
      return m.slug.toLowerCase().includes(q) || (m.label || m.slug).toLowerCase().includes(q) || (m.description?.toLowerCase().includes(q) ?? false);
    }).sort((a, b) => a.sort_order - b.sort_order);
  }, [modules, search]);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "relative max-w-sm", children: [
      /* @__PURE__ */ jsx(Search, { className: "absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" }),
      /* @__PURE__ */ jsx(
        Input,
        {
          placeholder: "Search modules...",
          className: "pl-8",
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-md border", children: /* @__PURE__ */ jsxs(Table, { children: [
      /* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsxs(TableRow, { children: [
        /* @__PURE__ */ jsx(TableHead, { className: "w-[80px]", children: "Order" }),
        /* @__PURE__ */ jsx(TableHead, { className: "w-[200px]", children: "Module" }),
        /* @__PURE__ */ jsx(TableHead, { className: "w-[200px]", children: "Type" }),
        /* @__PURE__ */ jsx(TableHead, { children: "Description" })
      ] }) }),
      /* @__PURE__ */ jsx(TableBody, { children: isLoading ? /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan: 4, className: "h-24 text-center", children: /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-full" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-full" }),
        /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-full" })
      ] }) }) }) : isError ? /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan: 4, className: "h-24 text-center text-destructive", children: "Failed to load modules." }) }) : filteredModules.length === 0 ? /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, { colSpan: 4, className: "h-24 text-center text-muted-foreground", children: "No modules found." }) }) : filteredModules.map((m) => /* @__PURE__ */ jsxs(TableRow, { children: [
        /* @__PURE__ */ jsx(TableCell, { className: "text-muted-foreground", children: m.sort_order }),
        /* @__PURE__ */ jsx(TableCell, { className: "font-medium", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
          /* @__PURE__ */ jsx("span", { children: m.label || m.slug }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground font-mono", children: m.slug })
        ] }) }),
        /* @__PURE__ */ jsx(TableCell, { children: m.is_core ? /* @__PURE__ */ jsx(Badge, { variant: "default", children: "System Core" }) : /* @__PURE__ */ jsx(Badge, { variant: "secondary", children: "Custom Extension" }) }),
        /* @__PURE__ */ jsx(TableCell, { className: "text-sm", children: m.description })
      ] }, m.slug)) })
    ] }) })
  ] });
}
export {
  ModulesPanel as default
};
//# sourceMappingURL=ModulesPanel.js.map
