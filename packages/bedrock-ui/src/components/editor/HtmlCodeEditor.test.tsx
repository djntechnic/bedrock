import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HtmlCodeEditor } from "./HtmlCodeEditor";

const content = (container: HTMLElement) => container.querySelector(".cm-content");

describe("HtmlCodeEditor", () => {
  it("renders the given HTML", () => {
    const { container } = render(<HtmlCodeEditor value="<div>Hello Testing</div>" />);
    expect(container.textContent).toContain("Hello Testing");
  });

  it("is read-only by default", () => {
    const { container } = render(<HtmlCodeEditor value="<p>x</p>" />);
    expect(content(container)?.getAttribute("contenteditable")).toBe("false");
  });

  it("is editable when readOnly is false", () => {
    const { container } = render(<HtmlCodeEditor value="<p>x</p>" readOnly={false} />);
    expect(content(container)?.getAttribute("contenteditable")).toBe("true");
  });

  it("hides the line-number gutter when showLineNumbers is false", () => {
    const { container } = render(<HtmlCodeEditor value="<p>x</p>" showLineNumbers={false} />);
    expect(container.querySelector(".cm-lineNumbers")).toBeNull();
  });

  it("renders an empty document without throwing", () => {
    const { container } = render(<HtmlCodeEditor value="" />);
    expect(content(container)).not.toBeNull();
  });

  it("merges a consumer className onto the wrapper", () => {
    const { container } = render(<HtmlCodeEditor value="" className="flex-1" />);
    expect(container.firstElementChild?.className).toContain("flex-1");
  });
});
