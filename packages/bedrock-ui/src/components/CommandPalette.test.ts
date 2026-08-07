/**
 * @file CommandPalette.test.ts
 * @description Group ordering for the palette's static routes.
 *
 * This was a hardcoded list of one application's group names. The failure it
 * produced is the quiet kind: every route registers, every route matches the
 * query, and the section renders nothing because its heading is not in the
 * array. Worth a test precisely because nothing throws.
 */
import { describe, expect, it } from "vitest";
import { groupOrder } from "./CommandPalette";
import type { CommandRouteItem } from "../lib/commandRoutes";

function route(id: string, group: string): CommandRouteItem {
  return { id, label: id, to: `/${id}`, group } as CommandRouteItem;
}

describe("groupOrder", () => {
  it("follows first appearance in the registered list", () => {
    const order = groupOrder([
      route("a", "Navigate"),
      route("b", "Admin"),
      route("c", "Navigate"),
    ]);
    expect(order).toEqual(["Navigate", "Admin"]);
  });

  it("returns each group once", () => {
    const order = groupOrder([
      route("a", "Catalog"),
      route("b", "Catalog"),
      route("c", "Catalog"),
    ]);
    expect(order).toEqual(["Catalog"]);
  });

  it("orders groups no bedrock release has ever heard of", () => {
    // The whole point. These are RynoGuy's, not MLBTracker's, and they must
    // render in the order registered rather than not at all.
    const order = groupOrder([
      route("a", "Gallery"),
      route("b", "Checklist"),
      route("c", "Blog"),
    ]);
    expect(order).toEqual(["Gallery", "Checklist", "Blog"]);
  });

  it("handles an app that registers no routes", () => {
    expect(groupOrder([])).toEqual([]);
  });
});
