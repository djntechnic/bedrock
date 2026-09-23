/**
 * @file PresentationalTableChrome.test.tsx
 * @description Coverage for the shared outer-chrome primitive consumed by the
 *              `PRESENTATIONAL_TABLES` allowlist: base layout & class
 *              forwarding, row-count formatting/pluralization, caption
 *              visibility, the toolbar slot, and the loading/empty state
 *              precedence rules.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PresentationalTableChrome, chromeClasses } from "./PresentationalTableChrome";

describe("base DOM layout & class forwarding", () => {
  it("wraps children inside a <table> carrying chromeClasses.table", () => {
    render(
      <PresentationalTableChrome>
        <tbody>
          <tr>
            <td>Griffey</td>
          </tr>
        </tbody>
      </PresentationalTableChrome>,
    );
    const table = screen.getByRole("table");
    for (const cls of chromeClasses.table.split(" ")) {
      expect(table).toHaveClass(cls);
    }
    expect(screen.getByText("Griffey")).toBeInTheDocument();
  });

  it("applies chromeClasses.container to the outer container", () => {
    const { container } = render(
      <PresentationalTableChrome>
        <tbody />
      </PresentationalTableChrome>,
    );
    const containerDiv = container.querySelector("table")!.parentElement!;
    for (const cls of chromeClasses.container.split(" ")) {
      expect(containerDiv).toHaveClass(cls);
    }
  });

  it("applies an optional className to the outer container", () => {
    const { container } = render(
      <PresentationalTableChrome className="custom-container">
        <tbody />
      </PresentationalTableChrome>,
    );
    const containerDiv = container.querySelector("table")!.parentElement!;
    expect(containerDiv).toHaveClass("custom-container");
  });

  it("applies an optional tableClassName to the <table> element", () => {
    render(
      <PresentationalTableChrome tableClassName="custom-table">
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByRole("table")).toHaveClass("custom-table");
  });
});

describe("row count formatting & pluralization", () => {
  it("pluralizes for a count greater than one", () => {
    render(
      <PresentationalTableChrome rowCount={5}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("5 rows")).toBeInTheDocument();
  });

  it("uses the singular form for a count of exactly one", () => {
    render(
      <PresentationalTableChrome rowCount={1}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });

  it("pluralizes for a count of zero", () => {
    render(
      <PresentationalTableChrome rowCount={0}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("0 rows")).toBeInTheDocument();
  });

  it("uses a custom countLabel verbatim instead of pluralizing 'row'/'rows'", () => {
    render(
      <PresentationalTableChrome rowCount={3} countLabel="batches">
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("3 batches")).toBeInTheDocument();
  });

  it("formats large counts with thousands separators", () => {
    render(
      <PresentationalTableChrome rowCount={1234}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("1,234 rows")).toBeInTheDocument();
  });
});

describe("caption visibility", () => {
  it("omits the caption/toolbar row when both rowCount and toolbar are undefined", () => {
    const { container } = render(
      <PresentationalTableChrome>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(container.querySelector(".justify-between")).not.toBeInTheDocument();
  });

  it("renders the caption row when only toolbar is provided", () => {
    render(
      <PresentationalTableChrome toolbar={<button>Export</button>}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("renders the caption row when only rowCount is provided", () => {
    render(
      <PresentationalTableChrome rowCount={2}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });
});

describe("toolbar slot", () => {
  it("renders the toolbar node alongside the row count", () => {
    render(
      <PresentationalTableChrome rowCount={4} toolbar={<button>Refresh</button>}>
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("4 rows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});

describe("loading state", () => {
  it("renders the loading status content in <tbody> and not children", () => {
    render(
      <PresentationalTableChrome isLoading>
        <tbody>
          <tr>
            <td>Real Content</td>
          </tr>
        </tbody>
      </PresentationalTableChrome>,
    );
    expect(screen.queryByText("Real Content")).not.toBeInTheDocument();
    // GridStatusContent's loading state renders skeleton placeholders.
    const table = screen.getByRole("table");
    expect(table.querySelector("tbody")).toBeInTheDocument();
  });

  it("applies the default colSpan of 1 while loading", () => {
    render(
      <PresentationalTableChrome isLoading>
        <tbody />
      </PresentationalTableChrome>,
    );
    const cell = screen.getByRole("table").querySelector("td")!;
    expect(cell).toHaveAttribute("colspan", "1");
  });

  it("applies a custom colSpan while loading", () => {
    render(
      <PresentationalTableChrome isLoading colSpan={6}>
        <tbody />
      </PresentationalTableChrome>,
    );
    const cell = screen.getByRole("table").querySelector("td")!;
    expect(cell).toHaveAttribute("colspan", "6");
  });
});

describe("empty state", () => {
  it("renders the default empty message and not children", () => {
    render(
      <PresentationalTableChrome isEmpty>
        <tbody>
          <tr>
            <td>Real Content</td>
          </tr>
        </tbody>
      </PresentationalTableChrome>,
    );
    expect(screen.queryByText("Real Content")).not.toBeInTheDocument();
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("renders a custom emptyMessage", () => {
    render(
      <PresentationalTableChrome isEmpty emptyMessage="No batches yet.">
        <tbody />
      </PresentationalTableChrome>,
    );
    expect(screen.getByText("No batches yet.")).toBeInTheDocument();
  });

  it("applies the default colSpan of 1 while empty", () => {
    render(
      <PresentationalTableChrome isEmpty>
        <tbody />
      </PresentationalTableChrome>,
    );
    const cell = screen.getByRole("table").querySelector("td")!;
    expect(cell).toHaveAttribute("colspan", "1");
  });

  it("applies a custom colSpan while empty", () => {
    render(
      <PresentationalTableChrome isEmpty colSpan={4}>
        <tbody />
      </PresentationalTableChrome>,
    );
    const cell = screen.getByRole("table").querySelector("td")!;
    expect(cell).toHaveAttribute("colspan", "4");
  });
});

describe("loading vs. empty precedence", () => {
  it("prefers the loading state when both isLoading and isEmpty are true", () => {
    render(
      <PresentationalTableChrome isLoading isEmpty emptyMessage="No batches yet.">
        <tbody>
          <tr>
            <td>Real Content</td>
          </tr>
        </tbody>
      </PresentationalTableChrome>,
    );
    expect(screen.queryByText("No batches yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Real Content")).not.toBeInTheDocument();
  });
});

describe("chromeClasses static export", () => {
  it("exposes the expected class-name keys used by consumer tables", () => {
    expect(Object.keys(chromeClasses).sort()).toEqual(
      ["body", "cell", "container", "headerCell", "headerRow", "row", "table"].sort(),
    );
    for (const value of Object.values(chromeClasses)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
