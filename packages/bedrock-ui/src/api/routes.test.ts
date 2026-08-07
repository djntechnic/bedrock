/**
 * @file routes.test.ts
 * @description Guards the platform/application boundary in the route map.
 *
 * This file exists because that boundary was breached silently. The map
 * shipped with MLBTracker's entire API in it — `players`, `leaderboard`,
 * `collection`, `catalog`, `transactions` — and nothing failed, because an
 * unused route builder is invisible to a type check and to an import graph
 * alike. A second application would simply have inherited the first one's API
 * as platform contract.
 *
 * So the assertion is on the *shape of the whole map*, not on individual
 * paths. A test that only checked the paths present would have passed before
 * the cleanup too.
 */
import { describe, expect, it } from "vitest";
import { API_ROUTES } from "./routes";

/** Every leaf builder in the map, as `group.name` → produced path. */
function allRoutes(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [group, builders] of Object.entries(API_ROUTES)) {
    for (const [name, build] of Object.entries(builders as Record<string, unknown>)) {
      if (typeof build !== "function") continue;
      // Every builder takes zero or more scalar arguments; a placeholder is
      // enough to produce a path, and `1` satisfies both string and number.
      const path = String((build as (...a: unknown[]) => string)(1, 1));
      out.push([`${group}.${name}`, path]);
    }
  }
  return out;
}

describe("the map holds platform routes only", () => {
  it("exposes exactly the groups bedrock-api serves", () => {
    // Adding a group is a deliberate act. If this fails because you added one,
    // check first that `bedrock-api` mounts it — if the application mounts it,
    // the builder belongs in the application's map.
    expect(Object.keys(API_ROUTES).sort()).toEqual([
      "admin",
      "appConfig",
      "auth",
      "diagnostics",
      "modules",
      "userPreferences",
    ]);
  });

  it("names no application domain in any path", () => {
    // The vocabulary that was in here before the split. Not an exhaustive list
    // of every possible domain word — nothing could be — but it fails loudly
    // if MLBTracker's map is pasted back.
    const domainWords = [
      "analytics",
      "leaderboard",
      "players",
      "player",
      "trend",
      "collection",
      "catalog",
      "transactions",
      "inventory",
      "photo",
      "season",
      "team",
      "alias",
      "card",
      "kpi",
    ];

    const offenders = allRoutes().filter(([, path]) =>
      domainWords.some((word) => path.toLowerCase().includes(word)),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps every path under the versioned API prefix", () => {
    for (const [name, path] of allRoutes()) {
      expect(path, name).toMatch(/^\/api\/v1\//);
    }
  });
});

describe("the builders themselves", () => {
  it("interpolates path parameters", () => {
    expect(API_ROUTES.admin.user(42)).toBe("/api/v1/admin/users/42");
    expect(API_ROUTES.admin.gridColumn("leaderboard", "ops")).toBe(
      "/api/v1/admin/grids/leaderboard/columns/ops",
    );
  });

  it("escapes a config key, which may contain a slash", () => {
    // Config keys are dotted and admin-editable; an unescaped one would
    // silently address a different route.
    expect(API_ROUTES.admin.configItem("grid/defaults")).toBe(
      "/api/v1/admin/config/grid%2Fdefaults",
    );
  });

  it("omits an optional query string rather than emitting a bare ?", () => {
    expect(API_ROUTES.admin.securityEvents()).toBe("/api/v1/admin/security/events");
    expect(API_ROUTES.admin.securityEvents("limit=10")).toBe(
      "/api/v1/admin/security/events?limit=10",
    );
    expect(API_ROUTES.admin.config()).toBe("/api/v1/admin/config");
    expect(API_ROUTES.admin.config("mail")).toBe("/api/v1/admin/config?category=mail");
  });

  it("encodes the OAuth state parameter", () => {
    expect(API_ROUTES.auth.googleAuthorize("/admin?tab=users")).toBe(
      "/api/v1/auth/google/authorize?state=%2Fadmin%3Ftab%3Dusers",
    );
  });
});
