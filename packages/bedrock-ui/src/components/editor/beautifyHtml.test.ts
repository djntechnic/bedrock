import { describe, it, expect } from "vitest";
import { beautifyHtml } from "./beautifyHtml";

describe("beautifyHtml", () => {
  it("formats unindented HTML tags with 2 spaces", () => {
    expect(beautifyHtml("<div><p>Hello World</p></div>")).toBe(
      "<div>\n  <p>Hello World</p>\n</div>\n",
    );
  });

  it("preserves whitespace inside <pre> tags", () => {
    expect(beautifyHtml("<div><pre>  formatted   text  </pre></div>")).toContain(
      "  formatted   text  ",
    );
  });

  it("preserves {{token}} placeholders", () => {
    expect(beautifyHtml("<p>{{title}} - {{price}}</p>")).toContain("{{title}} - {{price}}");
  });

  it("returns empty input unchanged", () => {
    expect(beautifyHtml("")).toBe("");
  });

  it("is idempotent", () => {
    const once = beautifyHtml("<ul><li>a</li><li>b</li></ul>");
    expect(beautifyHtml(once)).toBe(once);
  });
});
