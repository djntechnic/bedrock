/**
 * @file navRegistry.test.ts
 * @description Role gating for nav entries.
 *
 * The failure this guards against is silent in both directions: a mis-gated
 * entry either advertises an admin destination to everyone, or vanishes for the
 * admin who needs it, and neither throws. `role` is also deliberately not
 * `module` — the assertion that a role-gated entry is *hidden* rather than
 * rendered disabled is the whole reason the field exists.
 */
import { describe, expect, it } from "vitest";
import { Circle } from "lucide-react";
import { isNavItemVisible, type NavItem } from "./navRegistry";

function item(extra: Partial<NavItem> = {}): NavItem {
  return { to: "/x", label: "X", icon: Circle, ...extra };
}

/** `useAuth()`'s three facts, with a role set rather than a stub per test. */
function auth(user: unknown, isAdmin: boolean, roles: string[] = []) {
  return { user, isAdmin, hasRole: (slug: string) => roles.includes(slug) };
}

const ANON = auth(null, false);
const VIEWER = auth({ id: 1 }, false, ["viewer"]);
const ADMIN = auth({ id: 2 }, true, ["admin"]);

describe("isNavItemVisible", () => {
  it("shows an ungated entry to everyone, signed in or not", () => {
    expect(isNavItemVisible(item(), ANON)).toBe(true);
    expect(isNavItemVisible(item(), VIEWER)).toBe(true);
    expect(isNavItemVisible(item(), ADMIN)).toBe(true);
  });

  it("hides a role-gated entry from anonymous callers", () => {
    expect(isNavItemVisible(item({ role: "admin" }), ANON)).toBe(false);
  });

  it("hides a role-gated entry from a signed-in caller without the role", () => {
    expect(isNavItemVisible(item({ role: "admin" }), VIEWER)).toBe(false);
  });

  it("shows a role-gated entry to a caller holding the role", () => {
    expect(isNavItemVisible(item({ role: "viewer" }), VIEWER)).toBe(true);
  });

  it("shows a role-gated entry to an admin who lacks the role explicitly", () => {
    // Mirrors <ProtectedRoute>: `isAdmin` short-circuits `hasRole`, so a
    // superuser never loses a link to a route they can in fact open.
    expect(isNavItemVisible(item({ role: "member" }), ADMIN)).toBe(true);
  });

  it("still honours the legacy admin module gate", () => {
    expect(isNavItemVisible(item({ module: "admin" }), VIEWER)).toBe(false);
    expect(isNavItemVisible(item({ module: "admin" }), ADMIN)).toBe(true);
  });

  it("leaves a non-admin module entry to the hasModule() disabled path", () => {
    // Visible here on purpose — `<AppSidebar>` renders it greyed out rather
    // than removing it, which is how "not switched on" reads differently from
    // "not for you".
    expect(isNavItemVisible(item({ module: "reports" }), VIEWER)).toBe(true);
  });

  it("requires both when both are set", () => {
    const gated = item({ module: "admin", role: "admin" });
    expect(isNavItemVisible(gated, VIEWER)).toBe(false);
    expect(isNavItemVisible(gated, ADMIN)).toBe(true);
  });

  it("hides completely when is_hidden is true", () => {
    expect(isNavItemVisible(item({ is_hidden: true }), ADMIN)).toBe(false);
    expect(isNavItemVisible(item({ is_hidden: true }), VIEWER)).toBe(false);
  });

  it("hides entry when security.can(module, action) returns false", () => {
    const mockSecurity = {
      can: (mod: string, act: string = "view") => mod === "inventory" && act === "view",
    };

    // User can view inventory -> visible
    expect(isNavItemVisible(item({ module: "inventory" }), VIEWER, mockSecurity)).toBe(true);

    // User cannot update inventory -> hidden
    expect(isNavItemVisible(item({ module: "inventory", action: "update" }), VIEWER, mockSecurity)).toBe(false);

    // User cannot view reports -> hidden
    expect(isNavItemVisible(item({ module: "reports" }), VIEWER, mockSecurity)).toBe(false);
  });
});
