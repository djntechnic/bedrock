/**
 * @file PageHeader.test.tsx
 * @description Cover for the opt-in sticky page header.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader";

/**
 * The header's outermost element — the one carrying the position classes.
 * Taken from the render root rather than walked up from the heading, so the
 * assertions do not quietly move to an inner wrapper if the markup nests
 * differently.
 */
const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("PageHeader", () => {
  it("does not stick by default", () => {
    // Opt-in on purpose: `position: sticky` is inert outside a scroll
    // container but the negative-margin bleed is not, so switching it on for
    // every host would reflow pages nobody asked to change.
    const { container } = render(<PageHeader title="Listings" />);
    expect(root(container).className).not.toMatch(/\bsticky\b/);
  });

  it("pins to the top of the scroll container when asked", () => {
    const { container } = render(<PageHeader title="Listings" sticky />);
    const cls = root(container).className;
    expect(cls).toMatch(/\bsticky\b/);
    expect(cls).toMatch(/\btop-0\b/);
  });

  it("paints an opaque background behind the pinned header", () => {
    // Without it the rows scrolling underneath show through, which reads as a
    // rendering fault rather than a header.
    const { container } = render(<PageHeader title="Listings" sticky />);
    expect(root(container).className).toMatch(/\bbg-background\b/);
  });

  it("sits above grid headers but below dialogs", () => {
    const { container } = render(<PageHeader title="Listings" sticky />);
    expect(root(container).className).toMatch(/\bz-20\b/);
  });

  it("centers title and actions without extra top padding on the actions", () => {
    const { container } = render(<PageHeader title="Overview" actions={<button>Add</button>} />);
    const titleRow = root(container).firstElementChild as HTMLElement;
    expect(titleRow.className).toMatch(/\bitems-center\b/);
    expect(titleRow.className).not.toMatch(/\bitems-start\b/);

    const actionsContainer = screen.getByRole("button", { name: "Add" }).parentElement;
    expect(actionsContainer?.className).not.toMatch(/\bpt-0\.5\b/);
  });

  it("does not render the gradient separator bar", () => {
    const { container } = render(<PageHeader title="Overview" />);
    expect(container.querySelector(".bg-gradient-to-r")).toBeNull();
  });

  it("still renders subtitle and actions when pinned", () => {
    render(
      <PageHeader title="Listings" subtitle="All statuses" sticky actions={<button>New</button>} />,
    );
    expect(screen.getByText("All statuses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
