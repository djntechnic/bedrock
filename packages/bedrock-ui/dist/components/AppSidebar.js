import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { forwardRef, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleDot, ChevronDown, User, LogOut, PinOff, Pin } from "lucide-react";
import { isNavItemVisible } from "./navRegistry.js";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip.js";
import { useAppSettings } from "../hooks/useAppSettings.js";
import { useModules } from "../hooks/useModules.js";
import { useSecurity } from "../hooks/useSecurity.js";
import { useNavSettings } from "../hooks/useNavSettings.js";
import { useAuth } from "../hooks/useAuth.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { useSidebarStore } from "../store/sidebarStore.js";
const ProfileTarget = forwardRef(function ProfileTarget2({ to, className, title, children }, ref) {
  if (!to) {
    return /* @__PURE__ */ jsx("span", { ref, className, title, children });
  }
  return /* @__PURE__ */ jsx(
    Link,
    {
      ref,
      to,
      className,
      title,
      children
    }
  );
});
function AppSidebar({ profilePath = "/profile" } = {}) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState(/* @__PURE__ */ new Set());
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
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, mobileOpen, setMobileOpen]);
  const expanded = isMobile ? mobileOpen : pinned || hovered;
  const collapsed = !expanded;
  function isParentActive(item) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(item.to + "/");
  }
  function isChildActive(child) {
    const qIdx = child.to.indexOf("?");
    if (qIdx === -1) return location.pathname === child.to;
    const path = child.to.slice(0, qIdx);
    const search = child.to.slice(qIdx);
    return location.pathname === path && location.search === search;
  }
  function allSubItems(item) {
    if (item.children) return item.children;
    if (item.groups) return item.groups.flatMap((g) => g.items);
    return [];
  }
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
  }, [location.pathname, navItems]);
  function toggleSection(path) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  function isSectionOpen(item) {
    return openSections.has(item.to);
  }
  if (isMobile && !mobileOpen) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    isMobile && mobileOpen && /* @__PURE__ */ jsx(
      "div",
      {
        "data-testid": "sidebar-mobile-backdrop",
        className: "fixed inset-0 z-40 bg-black/40",
        onClick: () => setMobileOpen(false),
        "aria-hidden": "true"
      }
    ),
    /* @__PURE__ */ jsxs(
      "aside",
      {
        onMouseEnter: () => !isMobile && !pinned && setHovered(true),
        onMouseLeave: () => !isMobile && !pinned && setHovered(false),
        className: [
          "app-sidebar fixed left-0 top-0 h-screen flex flex-col",
          "bg-card border-r border-border z-50",
          "transition-all duration-200 ease-in-out motion-reduce:transition-none",
          collapsed ? "w-16" : "w-60"
        ].join(" "),
        children: [
          /* @__PURE__ */ jsx("div", { className: "h-14 flex items-center px-3 border-b border-border shrink-0 overflow-hidden bg-primary/5", children: /* @__PURE__ */ jsxs(Link, { to: "/", className: "flex items-center gap-2.5 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", children: [
            /* @__PURE__ */ jsx("div", { className: "shrink-0 h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm ring-1 ring-primary/20", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 20 20", className: "h-4 w-4 fill-primary-foreground", "aria-hidden": true, children: [
              /* @__PURE__ */ jsx("circle", { cx: "10", cy: "10", r: "8", stroke: "currentColor", strokeWidth: "1.5", fill: "none", className: "stroke-primary-foreground/60" }),
              /* @__PURE__ */ jsx("path", { d: "M10 2 Q12 10 10 18 Q8 10 10 2Z", fill: "currentColor", opacity: "0.9" }),
              /* @__PURE__ */ jsx("path", { d: "M2 10 Q10 12 18 10 Q10 8 2 10Z", fill: "currentColor", opacity: "0.9" })
            ] }) }),
            !collapsed && /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "font-bold text-sm leading-tight text-foreground tracking-tight truncate", children: system.appName }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-muted-foreground leading-tight font-medium tracking-wide uppercase", children: "Analytics" })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx("nav", { className: "flex-1 overflow-y-auto py-3 space-y-0.5 px-2", children: navItems.map((rawItem) => {
            if (!isNavItemVisible(rawItem, { user, isAdmin, hasRole }, security)) {
              return null;
            }
            const filteredChildren = rawItem.children?.filter(
              (child) => isNavItemVisible(child, { user, isAdmin, hasRole }, security)
            );
            const filteredGroups = rawItem.groups?.map((g) => ({
              ...g,
              items: g.items.filter(
                (child) => isNavItemVisible(child, { user, isAdmin, hasRole }, security)
              )
            })).filter((g) => g.items.length > 0);
            const item = {
              ...rawItem,
              children: filteredChildren?.length ? filteredChildren : void 0,
              groups: filteredGroups?.length ? filteredGroups : void 0
            };
            const originallyHadChildren = !!(rawItem.children?.length || rawItem.groups?.length);
            const hasChildren = !!(item.children?.length || item.groups?.length);
            if (originallyHadChildren && !hasChildren && !item.exact) {
              return null;
            }
            const active = isParentActive(item);
            const Icon = item.icon || CircleDot;
            const open = hasChildren && isSectionOpen(item);
            const disabled = !!item.module && !hasModule(item.module);
            if (collapsed) {
              const iconLink = disabled ? /* @__PURE__ */ jsx(
                "span",
                {
                  "aria-disabled": "true",
                  "data-testid": `nav-${item.module}-disabled`,
                  className: "flex items-center justify-center px-2.5 py-2 rounded-md text-muted-foreground/40 cursor-not-allowed select-none",
                  children: /* @__PURE__ */ jsx(Icon, { className: "shrink-0 h-[18px] w-[18px]" })
                }
              ) : /* @__PURE__ */ jsx(
                Link,
                {
                  to: item.to,
                  title: item.tooltip || void 0,
                  className: [
                    "flex items-center justify-center px-2.5 py-2 rounded-md",
                    "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  ].join(" "),
                  children: /* @__PURE__ */ jsx(Icon, { className: "shrink-0 h-[18px] w-[18px]" })
                }
              );
              return /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: iconLink }),
                /* @__PURE__ */ jsxs(TooltipContent, { side: "right", className: "text-xs", children: [
                  disabled ? `${item.label} — not enabled for your account` : /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("div", { className: "font-semibold", children: item.label }),
                    item.tooltip && /* @__PURE__ */ jsx("div", { className: "text-[11px] text-muted-foreground mt-0.5 max-w-[200px]", children: item.tooltip })
                  ] }),
                  hasChildren && /* @__PURE__ */ jsx("div", { className: "mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5", children: allSubItems(item).map((child) => /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs(
                    Link,
                    {
                      to: child.to,
                      title: child.tooltip || void 0,
                      className: [
                        "block px-2 py-0.5 rounded text-xs",
                        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isChildActive(child) ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                      ].join(" "),
                      children: [
                        /* @__PURE__ */ jsx("span", { children: child.label }),
                        child.tooltip && /* @__PURE__ */ jsx("span", { className: "block text-[10px] text-muted-foreground font-normal", children: child.tooltip })
                      ]
                    }
                  ) }, child.to)) })
                ] })
              ] }, item.to);
            }
            return /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                disabled ? /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                  /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
                    "span",
                    {
                      "aria-disabled": "true",
                      "data-testid": `nav-${item.module}-disabled`,
                      className: "flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium text-muted-foreground/40 cursor-not-allowed select-none",
                      children: [
                        /* @__PURE__ */ jsx(Icon, { className: "shrink-0 h-[18px] w-[18px]" }),
                        /* @__PURE__ */ jsx("span", { className: "truncate", children: item.label })
                      ]
                    }
                  ) }),
                  /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: "Not enabled for your account" })
                ] }) : item.tooltip ? /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                  /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
                    Link,
                    {
                      to: item.to,
                      title: item.tooltip || void 0,
                      className: [
                        "flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium",
                        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      ].join(" "),
                      children: [
                        /* @__PURE__ */ jsx(Icon, { className: "shrink-0 h-[18px] w-[18px]" }),
                        /* @__PURE__ */ jsx("span", { className: "truncate", children: item.label })
                      ]
                    }
                  ) }),
                  /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: item.tooltip })
                ] }) : /* @__PURE__ */ jsxs(
                  Link,
                  {
                    to: item.to,
                    className: [
                      "flex-1 flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium",
                      "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    ].join(" "),
                    children: [
                      /* @__PURE__ */ jsx(Icon, { className: "shrink-0 h-[18px] w-[18px]" }),
                      /* @__PURE__ */ jsx("span", { className: "truncate", children: item.label })
                    ]
                  }
                ),
                hasChildren && /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => toggleSection(item.to),
                    className: [
                      "shrink-0 p-1 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "text-primary/70 hover:text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    ].join(" "),
                    title: open ? "Collapse" : "Expand",
                    children: /* @__PURE__ */ jsx(
                      ChevronDown,
                      {
                        className: [
                          "h-3.5 w-3.5 transition-transform duration-150",
                          open ? "rotate-0" : "-rotate-90"
                        ].join(" ")
                      }
                    )
                  }
                )
              ] }),
              hasChildren && open && !disabled && /* @__PURE__ */ jsxs("div", { className: "mt-0.5 ml-4 pl-3 border-l border-border space-y-0.5", children: [
                item.children && item.children.map((child) => {
                  const childActive = isChildActive(child);
                  const childLink = /* @__PURE__ */ jsx(
                    Link,
                    {
                      to: child.to,
                      title: child.tooltip || void 0,
                      className: [
                        "flex items-center px-2 py-1.5 rounded-md text-xs font-medium",
                        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        childActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      ].join(" "),
                      children: child.label
                    },
                    child.to
                  );
                  if (child.tooltip) {
                    return /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                      /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: childLink }),
                      /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: child.tooltip })
                    ] }, child.to);
                  }
                  return childLink;
                }),
                item.groups && item.groups.map((group) => /* @__PURE__ */ jsxs("div", { className: "pt-1.5", children: [
                  /* @__PURE__ */ jsx("p", { className: "px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60", children: group.label }),
                  group.items.map((child) => {
                    const childActive = isChildActive(child);
                    const groupChildLink = /* @__PURE__ */ jsx(
                      Link,
                      {
                        to: child.to,
                        title: child.tooltip || void 0,
                        className: [
                          "flex items-center px-2 py-1.5 rounded-md text-xs font-medium",
                          "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          childActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        ].join(" "),
                        children: child.label
                      },
                      child.to
                    );
                    if (child.tooltip) {
                      return /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                        /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: groupChildLink }),
                        /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: child.tooltip })
                      ] }, child.to);
                    }
                    return groupChildLink;
                  })
                ] }, group.label))
              ] })
            ] }, item.to);
          }) }),
          /* @__PURE__ */ jsx("div", { className: "border-t border-border p-2 shrink-0", children: collapsed ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-1", children: [
            user ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                  ProfileTarget,
                  {
                    to: profilePath,
                    className: [
                      "flex items-center justify-center p-2 rounded-md text-muted-foreground transition-colors outline-none",
                      profilePath ? "hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" : ""
                    ].join(" "),
                    children: /* @__PURE__ */ jsx(User, { className: "h-4 w-4" })
                  }
                ) }),
                /* @__PURE__ */ jsxs(TooltipContent, { side: "right", className: "text-xs", children: [
                  "Profile: ",
                  user.display_name || user.email
                ] })
              ] }),
              /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
                /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      void logout();
                    },
                    className: "flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    children: /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4" })
                  }
                ) }),
                /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: "Sign out" })
              ] })
            ] }) : /* @__PURE__ */ jsxs(Tooltip, { delayDuration: 0, children: [
              /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
                Link,
                {
                  to: "/login",
                  className: "flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  children: /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4 rotate-180" })
                }
              ) }),
              /* @__PURE__ */ jsx(TooltipContent, { side: "right", className: "text-xs", children: "Sign in" })
            ] }),
            !isMobile && /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: togglePinned,
                title: pinned ? "Unpin sidebar" : "Pin sidebar open",
                className: "flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                children: pinned ? /* @__PURE__ */ jsx(PinOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Pin, { className: "h-4 w-4" })
              }
            )
          ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-1", children: [
            user ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(
                ProfileTarget,
                {
                  to: profilePath,
                  title: profilePath ? "View profile" : void 0,
                  className: [
                    "flex-1 min-w-0 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-foreground transition-colors outline-none",
                    profilePath ? "hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" : ""
                  ].join(" "),
                  children: [
                    /* @__PURE__ */ jsx(User, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
                    /* @__PURE__ */ jsx("span", { className: "truncate", children: user.display_name || user.email })
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    void logout();
                  },
                  title: "Sign out",
                  className: "shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  children: /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4" })
                }
              )
            ] }) : /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/login",
                title: "Sign in",
                className: "flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                children: [
                  /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4 rotate-180 shrink-0" }),
                  /* @__PURE__ */ jsx("span", { children: "Sign in" })
                ]
              }
            ),
            !isMobile && /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: togglePinned,
                title: pinned ? "Unpin sidebar" : "Pin sidebar open",
                className: "shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                children: pinned ? /* @__PURE__ */ jsx(PinOff, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(Pin, { className: "h-4 w-4" })
              }
            )
          ] }) })
        ]
      }
    )
  ] });
}
export {
  AppSidebar as default
};
//# sourceMappingURL=AppSidebar.js.map
