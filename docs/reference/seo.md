# Public-site essentials

The SPA shipped a static `<title>` in `index.html` and nothing else — no
per-route meta, no sitemap, no robots.txt, no preview tags. An internal tool
does not care. A public site lives on it: every page shares one title in search
results, and a shared link previews as the application's name with no image and
no summary. Plan F5.

## Per-route head

```tsx
import { useDocumentHead } from "@djntechnic/bedrock-ui";

useDocumentHead({
  title: set.name,
  titleTemplate: "%s · RynoGuy",
  description: `Every card in ${set.name}, with checklist progress.`,
  canonical: `https://rynoguy.com/sets/${set.id}`,
  image: set.coverUrl,
  siteName: "RynoGuy",
});
```

Writes the title, `description`, `canonical`, the Open Graph set and the
Twitter card type.

**No `react-helmet`.** It would be a peer dependency, a provider every consumer
mounts, and a scheduler competing with React's — to write to `document.head`,
which is four lines. What Helmet genuinely buys is server-side rendering, and
bedrock does not render on the server. If that changes, this is the one module
to replace.

Notes worth having:

- `titleTemplate` takes the site name so one page cannot be the odd one out.
  Open Graph gets the **unframed** title, because a preview card renders the
  site name separately and "Page · Site" beside "Site" reads as a stutter.
- `canonical` matters on anything reachable at more than one URL — a filtered
  list whose query string does not change the content, most obviously. Without
  it, search engines pick a winner themselves and split the ranking of the ones
  they do not pick.
- `image` must be absolute. Most scrapers ignore a relative URL.
- Values are applied on change and **left in place on unmount**. Restoring the
  previous title mid-transition makes the tab flicker back to the old page, and
  the next route sets its own a moment later. A page that should not be indexed
  sets `noIndex` rather than relying on teardown.

## Sitemap and robots

The platform owns the format, the escaping, the size limit and the caching. It
cannot know a single URL of your application, so it knows none — the app
registers sources:

```python
from bedrock.core.sitemap import SitemapEntry, register_sitemap_source

def catalog_sets() -> list[SitemapEntry]:
    rows = db.query(f"SELECT set_id, updated_at FROM {T.CHECKLIST_SETS} WHERE approved = 1")
    return [
        SitemapEntry(loc=f"/catalog/sets/{r['set_id']}", lastmod=r["updated_at"],
                     changefreq="weekly")
        for _, r in rows.iterrows()
    ]

register_sitemap_source("catalog_sets", catalog_sets)
```

A registry, not a provider: a catalog's sets and a blog's posts both belong in
the same sitemap, so every source contributes and all of them run.

**Mount the router at the site root**, not under `/api/v1`. Both files are only
honoured at the root of a host, so `/api/v1/robots.txt` is a file no crawler
will ever request:

```python
app.include_router(seo.router)
```

In the compose stack nginx serves the SPA, so it needs to proxy these two paths
to the API:

```nginx
location = /sitemap.xml { proxy_pass http://api:8000/sitemap.xml; }
location = /robots.txt  { proxy_pass http://api:8000/robots.txt; }
```

### Behaviour worth knowing

- **A broken source is skipped, not fatal.** One failing query must not take
  every URL out of the file: a sitemap that 500s makes a crawler back off the
  whole site rather than one section.
- **An app that registers nothing gets a valid empty `<urlset>`**, not a 404 —
  the same degrade-when-unregistered contract every registry has.
- **Duplicates collapse**, first occurrence winning. Two sources listing the
  same page is a normal consequence of independent registration; a duplicate in
  the file is a defect a crawler reports.
- **Everything is escaped.** A URL with a query string contains `&`, and one
  raw ampersand makes the whole document unparseable — a single row taking down
  the entire sitemap.
- **Over 50,000 URLs truncates with a warning.** The protocol rejects a larger
  file outright, so a valid partial beats an invalid whole. Split into a
  sitemap index when a section reaches this.
- `GET /api/v1/seo/sources` names what is registered, because an empty sitemap
  is otherwise indistinguishable from a broken one.

### Settings

| Key | Default | Meaning |
| --- | --- | --- |
| `system_base_url` | `http://localhost:5173` | The public origin. The same setting F1 builds emailed links from — a site has one, configured once. A sitemap full of localhost URLs is the visible symptom of it being unset. |
| `seo_allow_indexing` | `true` | `false` writes a blanket `Disallow: /`, for staging. It asks well-behaved crawlers not to index and **is not access control** — staging with real data still needs authentication. |

## What is not here

**Prerendering and SSR.** A crawler that does not execute JavaScript sees an
empty shell, and `useDocumentHead` runs in the browser like everything else.
Google renders JS; most link-preview scrapers do not, which is the practical
consequence — a shared link may preview with `index.html`'s static tags rather
than the page's.

Fixing that properly is a rendering decision, not a head-management one: static
prerendering at build time, or SSR. The plan calls it a RynoGuy-time decision
and it still is. What belongs in bedrock is the primitive, which is here, and it
is the same call for either path.
