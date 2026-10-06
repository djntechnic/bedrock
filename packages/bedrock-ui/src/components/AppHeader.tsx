import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { useSidebarStore } from "../store/sidebarStore";

export interface AppHeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function AppHeader({ children, actions, className }: AppHeaderProps) {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  return (
    <header
      className={cn(
        "app-header sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden shrink-0"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
    </header>
  );
}
