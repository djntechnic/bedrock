/**
 * @file AppSidebar.tsx
 * @module frontend/src/components
 * @description Primary navigation sidebar. Defaults to a 64px icon rail;
 *              expands to 240px on hover (desktop overlay, doesn't reflow
 *              main content) or when pinned (persisted, pushes content).
 *              Below the 1024px breakpoint it's fully off-canvas, toggled by
 *              a hamburger button in the app header (see App.tsx).
 */
import { useState, useEffect, forwardRef, type ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ChevronDown,
  CircleDot,
  Pin,
  PinOff,
  LogOut,
  User,
} from "lucide-react";
import {
  isNavItemVisible,
  type NavItem,
  type SubItem,
} from "./navRegistry";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { useAppSettings } from "../hooks/useAppSettings";
import { useModules } from "../hooks/useModules";
import { useSecurity } from "../hooks/useSecurity";
import { useNavSettings } from "../hooks/useNavSettings";
import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useSidebarStore } from "../store/sidebarStore";

// The navigation tree itself lives in components/domain/navigation — it is
// pure application knowledge. This shell renders whatever the app registered.
// Types and the registry: ./navRegistry.

/**
 * The user block: a link when the app routes a profile screen, inert markup
 * when it does not.
 *
 * `forwardRef` because the collapsed variant is a `<TooltipTrigger asChild>`,
 * and Radix hands its trigger a ref either way.
 */
const ProfileTarget = forwardRef<
  HTMLElement,
  { to: string | null; className: string; title?: string; children: ReactNode }
>(function ProfileTarget({ to, className, title, children }, ref) {
  if (!to) {
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className={className} title={title}>
        {children}
      </span>
    );
  }
  return (
    <Link
      ref={ref as React.Ref<HTMLAnchorElement>}
      to={to}
      className={className}
      title={title}
    >
      {children}
    </Link>
  );
});

export interface AppSidebarProps {
  /**
   * Where the user block links. Defaults to `/profile`, which is where
   * `<ProfilePage>` is meant to be routed.
   *
   * Pass `null` if the app routes no profile screen at all: the block then
   * renders as plain text instead of a link into `No routes matched location`,
   * which is what it did for every app that had not built a profile screen of
   * its own.
   */
  profilePath?: string | null;
}

export default function AppSidebar({ profilePath = "/profile" }: AppSidebarProps = {}) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const { system } = useAppSettings();
  const { hasModule } = useModules();
  const { navItems } = useNavSettings();
  const security = useSecurity();
  const { user, isAdmin, hasRole, logout } = useAuth();

  const isMobile = useMediaQuery("(max-width: 1023px)");
  const pinned = useSidebarStore((s) => s.pinned);
  const hovered = useSidebarStore((s) => s.hovered);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const togglePinned = useSidebarStore((s) => s.togglePinned);
  const setHovered = useSidebarStore((s) => s.setHovered);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  // Below 1024px the sidebar is off-canvas; close it on every navigation.
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, mobileOpen, setMobileOpen]);

  const expanded = isMobile ? mobileOpen : pinned || hovered;
  const collapsed = !expanded;

  function isParentActive(item: NavItem) {
    if (item.exact) return location.pathname === item.to;
    return (
      location.pathname === item.to ||
      location.pathname.startsWith(item.to + "/")
    );
  }

  function isChildActive(child: SubItem) {
    const qIdx = child.to.indexOf("?");
    if (qIdx === -1) return location.pathname === child.to;
    const path = child.to.slice(0, qIdx);
    const search = child.to.slice(qIdx);
    return location.pathname === path && location.search === search;
  }

  function allSubItems(item: NavItem): SubItem[] {
    if (item.children) return item.children;
    if (item.groups) return item.groups.flatMap((g) => g.items);
    return [];
  }

  // Auto-open the section when navigating to it
  useEffect(() => {
    for (const item of navItems) {
      if ((item.children || item.groups) && isParentActive(item)) {
        setOpenSections((prev) => {
          if (prev.has(item.to)) return prev;
          const next = new Set(prev);
          next.add(item.to);
          return next;
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navItems]);

  function toggleSection(path: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function isSectionOpen(item: NavItem) {
    return openSections.has(item.to);
  }

  // Fully off-canvas on mobile until the hamburger opens it.
  if (isMobile && !mobileOpen) return null;

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          data-testid="sidebar-mobile-backdrop"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        onMouseEnter={() => !isMobile && !pinned && setHovered(true)}
        onMouseLeave={() => !isMobile && !pinned && setHovered(false)}
        className={[
          "app-sidebar fixed left-0 top-0 h-screen flex flex-col",
          "bg-card border-r border-border z-50",
          "transition-all duration-200 ease-in-out motion-reduce:transition-none",
          collapsed ? "w-16" : "w-60",
        ].join(" ")}
      >
      {/* Logo */}
      <div className="h-14 flex items-center px-3 border-b border-border shrink-0 overflow-hidden bg-primary/5">
        <Link to="/" className="flex items-center gap-2.5 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="shrink-0 h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm ring-1 ring-primary/20">
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-primary-foreground" aria-hidden>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="stroke-primary-foreground/60" />
              <path d="M10 2 Q12 10 10 18 Q8 10 10 2Z" fill="currentColor" opacity="0.9" />
              <path d="M2 10 Q10 12 18 10 Q10 8 2 10Z" fill="currentColor" opacity="0.9" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight text-foreground tracking-tight truncate">
                {system.appName}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight font-medium tracking-wide uppercase">
                Analytics
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {navItems.map((item) => {
          // Dynamic security gating completely hides unauthorized items
          if (!isNavItemVisible(item, { user, isAdmin, hasRole }, security)) {
            return null;
          }
          const active = isParentActive(item);
          const Icon = item.icon || CircleDot;
          const hasChildren = !!(item.children?.length || item.groups?.length);
          const open = hasChildren && isSectionOpen(item);
          const disabled = !!item.module && !hasModule(item.module);

          if (collapsed) {
            // Collapsed: icon only, links to base path, tooltip shows label
            const iconLink = disabled ? (
              <span
                aria-disabled="true"
                data-testid={`nav-${item.module}-disabled`}
                className="flex items-center justify-center px-2.5 py-2 rounded-md text-muted-foreground/40 cursor-not-allowed select-none"
              >
                <Icon className="shrink-0 h-[18px] w-[18px]" />
              </span>
            ) : (
              <Link
                to={item.to}
                title={item.tooltip || undefined}
                className={[
                  "flex items-center justify-center px-2.5 py-2 rounded-md",
                  "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="shrink-0 h-[18px] w-[18px]" />
              </Link>
            );

            return (
              <Tooltip key={item.to} delayDuration={0}>
                <TooltipTrigger asChild>{iconLink}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {disabled ? (
                    `${item.label} — not enabled for your account`
                  ) : (
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      {item.tooltip && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
                          {item.tooltip}
                        </div>
                      )}
                    </div>
                  )}
                  {hasChildren && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5">
                      {allSubItems(item).map((child) => (
                        <div key={child.to}>
                          <Link
                            to={child.to}
                            title={child.tooltip || undefined}
                            className={[
                              "block px-2 py-0.5 rounded text-xs",
                              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isChildActive(child)
                                ? "font-semibold text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            ].join(" ")}
                          >
                            <span>{child.label}</span>
                            {child.tooltip && (
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                {child.tooltip}
                              </span>
                            )}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }

          // Expanded mode
          return (
            <div key={item.to}>
              {/* Parent row */}
              <div className="flex items-center gap-1">
                {disabled ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span
                        aria-disabled="true"
                        data-testid={`nav-${item.module}-disabled`}
                        className="flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium text-muted-foreground/40 cursor-not-allowed select-none"
                      >
                        <Icon className="shrink-0 h-[18px] w-[18px]" />
                        <span className="truncate">{item.label}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      Not enabled for your account
                    </TooltipContent>
                  </Tooltip>
                ) : item.tooltip ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.to}
                        title={item.tooltip || undefined}
                        className={[
                          "flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium",
                          "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="shrink-0 h-[18px] w-[18px]" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    to={item.to}
                    className={[
                      "flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium",
                      "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="shrink-0 h-[18px] w-[18px]" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )}
                {hasChildren && (
                  <button
                    onClick={() => toggleSection(item.to)}
                    className={[
                      "shrink-0 p-1 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "text-primary/70 hover:text-primary hover:bg-primary/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                    title={open ? "Collapse" : "Expand"}
                  >
                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 transition-transform duration-150",
                        open ? "rotate-0" : "-rotate-90",
                      ].join(" ")}
                    />
                  </button>
                )}
              </div>

              {/* Children */}
              {hasChildren && open && !disabled && (
                <div className="mt-0.5 ml-4 pl-3 border-l border-border space-y-0.5">
                  {item.children && item.children.map((child) => {
                    const childActive = isChildActive(child);
                    const childLink = (
                      <Link
                        key={child.to}
                        to={child.to}
                        title={child.tooltip || undefined}
                        className={[
                          "flex items-center px-2 py-1.5 rounded-md text-xs font-medium",
                          "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          childActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        {child.label}
                      </Link>
                    );

                    if (child.tooltip) {
                      return (
                        <Tooltip key={child.to} delayDuration={0}>
                          <TooltipTrigger asChild>{childLink}</TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {child.tooltip}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return childLink;
                  })}
                  {item.groups && item.groups.map((group) => (
                    <div key={group.label} className="pt-1.5">
                      <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        {group.label}
                      </p>
                      {group.items.map((child) => {
                        const childActive = isChildActive(child);
                        const groupChildLink = (
                          <Link
                            key={child.to}
                            to={child.to}
                            title={child.tooltip || undefined}
                            className={[
                              "flex items-center px-2 py-1.5 rounded-md text-xs font-medium",
                              "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              childActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            ].join(" ")}
                          >
                            {child.label}
                          </Link>
                        );

                        if (child.tooltip) {
                          return (
                            <Tooltip key={child.to} delayDuration={0}>
                              <TooltipTrigger asChild>{groupChildLink}</TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {child.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return groupChildLink;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-2 shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {user ? (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <ProfileTarget
                      to={profilePath}
                      className={[
                        "flex items-center justify-center p-2 rounded-md text-muted-foreground transition-colors outline-none",
                        profilePath
                          ? "hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          : "",
                      ].join(" ")}
                    >
                      <User className="h-4 w-4" />
                    </ProfileTarget>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    Profile: {user.display_name || user.email}
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => { void logout(); }}
                      className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    Sign out
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to="/login"
                    className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4 rotate-180" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Sign in
                </TooltipContent>
              </Tooltip>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={togglePinned}
                title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            {user ? (
              <>
                <ProfileTarget
                  to={profilePath}
                  title={profilePath ? "View profile" : undefined}
                  className={[
                    "flex-1 min-w-0 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-foreground transition-colors outline-none",
                    profilePath
                      ? "hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      : "",
                  ].join(" ")}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{user.display_name || user.email}</span>
                </ProfileTarget>
                <button
                  type="button"
                  onClick={() => { void logout(); }}
                  title="Sign out"
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                title="Sign in"
                className="flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="h-4 w-4 rotate-180 shrink-0" />
                <span>Sign in</span>
              </Link>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={togglePinned}
                title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
