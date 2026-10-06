import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { useSidebarStore } from "../store/sidebarStore";
import { useMediaQuery } from "../hooks/useMediaQuery";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import GlobalSearchBar from "./GlobalSearchBar";

export interface AppShellProps {
  layout?: "default" | "workbench" | "fullBleed";
  sidebar?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode | null;
  children: ReactNode;
  className?: string;
}

export default function AppShell({
  layout = "default",
  sidebar,
  header,
  footer,
  children,
  className,
}: AppShellProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const pinned = useSidebarStore((s) => s.pinned);
  const hovered = useSidebarStore((s) => s.hovered);

  const sidebarOffset = isMobile ? "ml-0" : pinned || hovered ? "ml-60" : "ml-16";

  const resolvedSidebar = sidebar ?? <AppSidebar />;
  const resolvedHeader =
    layout === "fullBleed" ? null : (header ?? <AppHeader><GlobalSearchBar /></AppHeader>);
  const resolvedFooter = footer === null ? null : (footer ?? <AppFooter />);

  return (
    <div className={cn("min-h-screen bg-background text-foreground flex flex-col", className)}>
      {resolvedSidebar}
      <div
        data-testid="app-shell-main-column"
        className={cn("flex flex-1 flex-col min-h-screen transition-all duration-200", sidebarOffset)}
      >
        {resolvedHeader}
        <main
          className={cn(
            "flex-1 min-h-0 flex flex-col",
            layout === "default" && "p-4 sm:p-6",
            layout === "workbench" && "p-0 overflow-hidden",
            layout === "fullBleed" && "p-0"
          )}
        >
          {children}
        </main>
        {resolvedFooter}
      </div>
    </div>
  );
}
