# Server-side pagination

Grids page in the browser by default: `GridWrapper` receives the whole dataset
and slices it. That is right until the dataset stops being something you want
to send to a browser — a large checklist, a growing gallery, an audit log.

Switching one grid is **additive**. Nothing about the other grids changes, and
the prop is absent from every call site that does not want it.

## The two halves

**Server.** `bedrock.schemas.pagination` gives every paginated endpoint the
same shape:

```python
from fastapi import Depends
from bedrock.schemas.pagination import Page, PageParams, page_params

@router.get("/cards", response_model=Page[CardRow])
def list_cards(params: PageParams = Depends(page_params)):
    rows = db.query(
        f"SELECT * FROM {T.CARDS} ORDER BY card_id LIMIT %s OFFSET %s",
        (params.limit, params.offset),
    )
    total = db.query(f"SELECT COUNT(*) AS n FROM {T.CARDS}")[0]["n"]
    return Page.build(rows, total=total, params=params)
```

`page_size` is capped at 500. Not a style preference: without a ceiling,
`?page_size=1000000` is a request to materialise the whole table, which is the
denial of service pagination was added to prevent. The bounds live in `Query`,
so an out-of-range value is a 422 with a field-level message and the limits
appear in the OpenAPI schema — where a client author looks before asking for a
million rows.

`total` must be the count of everything matching the filters, not
`len(items)`. Passing the page length produces a pager that always claims
exactly one page, and it looks correct on page one.

**Client.** Pass `pagination` to `GridWrapper` and `rows` becomes one page:

```tsx
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(50);
const { data, isFetching } = useCards({ page, pageSize });

<GridWrapper
  rows={data?.items ?? []}
  defaultPageSize={config.defaultPageSize}
  pagination={{
    manual: true,
    totalRows: data?.total ?? 0,
    pageCount: data?.page_count,
    isFetching,
    onPageChange: (nextPage, nextSize) => {
      setPage(nextPage);
      setPageSize(nextSize);
    },
  }}
>
  {(rows) => <DataGrid rows={rows} config={config} />}
</GridWrapper>
```

## Things that bite

**`onPageChange` fires on mount**, once, with the configured page size.
`useGridConfig` resolves after first paint, so without that call a
server-paginated grid fetches the fallback 50 rows and then renders a pager
built for the admin-configured size. Your fetch hook should be keyed on page
and size and simply refetch.

**Changing the page size always resets to page 1.** Page 4 of 50-row pages is a
different set of rows than page 4 of 100-row pages, so keeping the number shows
something else without saying so.

**Pass `isFetching`.** It disables the controls in flight. Without it a
double-click on Next fires two page changes and lands two pages on, having
skipped one.

**Pass `pageCount` when your count is an estimate.** A large Postgres table
often uses one rather than a `COUNT(*)` that scans. `GridWrapper` prefers
`pageCount` over the number it would derive from `totalRows`.

**Sorting and filtering are now the server's job too.** `DataGrid` sorts the
rows it is handed, which under manual pagination is one page — so a column sort
reorders 50 rows out of 5,000 and looks broken. Feed the sort state into the
query, or leave the grid on client-side pagination.

## What is not here

**Cursor pagination.** Offset pagination re-scans on deep pages and can skip or
repeat a row when the underlying data shifts between requests. Neither matters
at the sizes bedrock apps have today, and a cursor API is a different contract
— no page numbers, no jumping to the last page — so it lands when something
actually needs it rather than as speculation.

**A query builder.** `bedrock.schemas.pagination` is a contract, not an ORM: it
does not touch the database, compose SQL, or know what a row is. The endpoint
writes its own query, where the indexes and joins it needs are visible.
