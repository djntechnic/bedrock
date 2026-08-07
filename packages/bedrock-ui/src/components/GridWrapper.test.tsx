/**
 * @file GridWrapper.test.tsx
 * @description Client-side and server-side pagination (plan F3).
 *
 * The client-side half is written first and deliberately: F3's whole premise
 * is that server pagination is *additive*, and the way to make that a fact
 * rather than a claim is to assert the old behaviour still holds with the new
 * prop absent.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GridWrapper from "./GridWrapper";

function rowsOf(n: number): Array<{ id: number }> {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
}

/** Renders the ids it is given, so a test can read the visible slice. */
function renderRows(rows: Array<{ id: number }>) {
  return <div data-testid="ids">{rows.map((r) => r.id).join(",")}</div>;
}

function visibleIds(): number[] {
  const text = screen.getByTestId("ids").textContent ?? "";
  return text ? text.split(",").map(Number) : [];
}

// ── Client-side: unchanged ───────────────────────────────────────────────────

describe("client-side (no pagination prop)", () => {
  it("slices the rows it is given", () => {
    render(
      <GridWrapper rows={rowsOf(120)} defaultPageSize={50}>
        {renderRows}
      </GridWrapper>,
    );
    expect(visibleIds()).toHaveLength(50);
    expect(visibleIds()[0]).toBe(1);
    expect(screen.getByText(/120 rows/)).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("advances a page without asking anyone", async () => {
    const user = userEvent.setup();
    render(
      <GridWrapper rows={rowsOf(120)} defaultPageSize={50}>
        {renderRows}
      </GridWrapper>,
    );
    await user.click(screen.getByLabelText("Next page"));
    expect(visibleIds()[0]).toBe(51);
  });

  it("shows a short last page rather than padding it", async () => {
    const user = userEvent.setup();
    render(
      <GridWrapper rows={rowsOf(120)} defaultPageSize={50}>
        {renderRows}
      </GridWrapper>,
    );
    await user.click(screen.getByLabelText("Last page"));
    expect(visibleIds()).toHaveLength(20);
  });

  it("hides the controls when everything fits on one page", () => {
    render(
      <GridWrapper rows={rowsOf(10)} defaultPageSize={50}>
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
  });

  it("still honours totalOverride for the label only", () => {
    render(
      <GridWrapper rows={rowsOf(10)} defaultPageSize={50} totalOverride={9999}>
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText(/9,999 rows/)).toBeInTheDocument();
    expect(visibleIds()).toHaveLength(10);
  });

  it("renders every row when pagination is disabled", () => {
    render(
      <GridWrapper rows={rowsOf(120)} paginationEnabled={false}>
        {renderRows}
      </GridWrapper>,
    );
    expect(visibleIds()).toHaveLength(120);
  });
});

// ── Server-side ──────────────────────────────────────────────────────────────

describe("server-side (pagination.manual)", () => {
  it("does not slice the page the server already sliced", () => {
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 5000, onPageChange: vi.fn() }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(visibleIds()).toHaveLength(25);
  });

  it("derives the pager from the server's total, not the page length", () => {
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 5000, onPageChange: vi.fn() }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText(/5,000 rows/)).toBeInTheDocument();
    expect(screen.getByText("1 / 200")).toBeInTheDocument();
  });

  it("asks the caller to fetch the next page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 5000, onPageChange }}
      >
        {renderRows}
      </GridWrapper>,
    );
    onPageChange.mockClear();
    await user.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(2, 25);
  });

  it("resets to page 1 when the page size changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pageSizeOptions={[25, 50]}
        pagination={{ manual: true, totalRows: 5000, onPageChange }}
      >
        {renderRows}
      </GridWrapper>,
    );
    await user.click(screen.getByLabelText("Next page"));
    onPageChange.mockClear();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "50 / page" }));

    // Page 4 of 50-row pages is a different set of rows than page 4 of 25-row
    // pages, so staying on 2 would show something else without saying so.
    expect(onPageChange).toHaveBeenCalledWith(1, 50);
  });

  it("announces the configured page size once it resolves", async () => {
    // useGridConfig lands after first paint. Without this the grid fetches the
    // fallback size and then renders a pager built for the configured one.
    const onPageChange = vi.fn();
    const { rerender } = render(
      <GridWrapper
        rows={rowsOf(50)}
        defaultPageSize={50}
        pagination={{ manual: true, totalRows: 5000, onPageChange }}
      >
        {renderRows}
      </GridWrapper>,
    );
    onPageChange.mockClear();

    rerender(
      <GridWrapper
        rows={rowsOf(50)}
        defaultPageSize={100}
        pagination={{ manual: true, totalRows: 5000, onPageChange }}
      >
        {renderRows}
      </GridWrapper>,
    );

    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(1, 100));
  });

  it("prefers an explicit pageCount over the derived one", () => {
    // A large table's row count is often an estimate; the page count the
    // server reports is then the authoritative number.
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{
          manual: true, totalRows: 5000, pageCount: 7, onPageChange: vi.fn(),
        }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText("1 / 7")).toBeInTheDocument();
  });

  it("lets the caller control the page", () => {
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 5000, page: 4, onPageChange: vi.fn() }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText("4 / 200")).toBeInTheDocument();
  });

  it("cannot be driven past the last page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 50, page: 2, onPageChange }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    await user.click(screen.getByLabelText("Last page"));
    expect(onPageChange).not.toHaveBeenCalledWith(3, expect.anything());
  });

  it("disables the controls while a page is in flight", () => {
    // Otherwise a double-click on Next fires two page changes and lands two
    // pages on, having skipped one.
    render(
      <GridWrapper
        rows={rowsOf(25)}
        defaultPageSize={25}
        pagination={{
          manual: true, totalRows: 5000, isFetching: true, onPageChange: vi.fn(),
        }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Last page")).toBeDisabled();
  });

  it("handles an empty result without a zeroth page", () => {
    render(
      <GridWrapper
        rows={[]}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 0, onPageChange: vi.fn() }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText(/0 rows/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
  });

  it("says 'row' rather than 'rows' for one", () => {
    render(
      <GridWrapper
        rows={rowsOf(1)}
        defaultPageSize={25}
        pagination={{ manual: true, totalRows: 1, onPageChange: vi.fn() }}
      >
        {renderRows}
      </GridWrapper>,
    );
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });
});
