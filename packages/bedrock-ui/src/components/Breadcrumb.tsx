/**
 * @file Breadcrumb.tsx
 * @module frontend/src/components
 * @description Shared breadcrumb navigation. Renders an accessible ordered trail
 * where every item except the last links via react-router; the final item is
 * marked as the current page. Separators are decorative and hidden from
 * assistive technology.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

/** A single breadcrumb entry. */
export interface BreadcrumbItem {
  /** Visible label for the crumb. */
  label: string;
  /** Optional route; when omitted (or on the last item) the crumb renders as text. */
  href?: string;
}

/** Props for {@link Breadcrumb}. */
interface BreadcrumbProps {
  /** Ordered trail from root to current page. */
  items: BreadcrumbItem[];
  /** Optional separator node between crumbs. */
  separator?: ReactNode;
  /** Extra classes merged onto the `<nav>` element. */
  className?: string;
}

/**
 * Renders an accessible breadcrumb trail.
 *
 * @param props - See {@link BreadcrumbProps}.
 * @returns The `<nav>` breadcrumb element.
 */
export default function Breadcrumb({ items, separator, className }: BreadcrumbProps) {
  const defaultSeparator = (
    <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0 select-none" />
  );

  return (
    <nav aria-label="Breadcrumb" className={cn(className)}>
      <ol className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="select-none flex items-center">
                  {separator ?? defaultSeparator}
                </span>
              )}
              {isLast || !item.href ? (
                <span className={isLast ? "text-foreground font-medium" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
