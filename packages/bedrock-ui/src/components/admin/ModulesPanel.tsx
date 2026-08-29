import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../api/routes";
import { queryKeys } from "../../hooks/queryKeys";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Search } from "lucide-react";

export interface ModuleItem {
  module_id: number;
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_core: boolean;
}

export default function ModulesPanel() {
  const [search, setSearch] = useState("");

  const { data: modules = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.modules.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<ModuleItem[]>(
        API_ROUTES.modules.list()
      );
      return data;
    },
  });

  const filteredModules = useMemo(() => {
    return modules
      .filter((m) => {
        const q = search.toLowerCase();
        return (
          m.slug.toLowerCase().includes(q) ||
          (m.label || m.slug).toLowerCase().includes(q) ||
          (m.description?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [modules, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search modules..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Order</TableHead>
              <TableHead className="w-[200px]">Module</TableHead>
              <TableHead className="w-[200px]">Type</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                  Failed to load modules.
                </TableCell>
              </TableRow>
            ) : filteredModules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No modules found.
                </TableCell>
              </TableRow>
            ) : (
              filteredModules.map((m) => (
                <TableRow key={m.slug}>
                  <TableCell className="text-muted-foreground">
                    {m.sort_order}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{m.label || m.slug}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {m.slug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.is_core ? (
                      <Badge variant="default">System Core</Badge>
                    ) : (
                      <Badge variant="secondary">Custom Extension</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
