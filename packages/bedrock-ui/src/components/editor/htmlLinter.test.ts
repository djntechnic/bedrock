import { describe, it, expect } from "vitest";
import { Text } from "@codemirror/state";
import { lintHtmlDocument } from "./htmlLinter";

const doc = (s: string) => Text.of(s.split("\n"));

describe("lintHtmlDocument", () => {
  it("reports nothing for an empty document", () => {
    expect(lintHtmlDocument(doc(""))).toEqual([]);
  });

  it("reports nothing for well-formed HTML with {{token}} placeholders", () => {
    expect(lintHtmlDocument(doc("<div><p>{{title}}</p></div>"))).toEqual([]);
  });

  it("flags an unclosed tag with a range inside the document", () => {
    const d = doc("<div>\n<p>oops\n</div>");
    const diagnostics = lintHtmlDocument(d);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const item of diagnostics) {
      expect(item.from).toBeGreaterThanOrEqual(0);
      expect(item.to).toBeLessThanOrEqual(d.length);
      expect(item.to).toBeGreaterThan(item.from);
    }
  });

  it("flags duplicate ids", () => {
    const messages = lintHtmlDocument(doc('<p id="a"></p><p id="a"></p>')).map((d) => d.message);
    expect(messages.some((m) => /id/i.test(m))).toBe(true);
  });
});
