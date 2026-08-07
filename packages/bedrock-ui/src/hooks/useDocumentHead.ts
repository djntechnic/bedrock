/**
 * @file useDocumentHead.ts
 * @module @djntechnic/bedrock-ui/hooks
 * @description Per-route document head: title, description, canonical, and the
 *              Open Graph / Twitter tags a link preview reads (plan F5).
 *
 * The SPA shipped a static `<title>` in `index.html` and nothing else. An
 * internal tool does not care. A public site does: every page shares one title
 * in search results and in a browser's history, and a shared link previews as
 * the application's name with no image and no summary.
 *
 * **No `react-helmet`.** It would be a peer dependency, a context provider
 * every consumer has to mount, and a scheduler competing with React's own —
 * for the sake of writing to `document.head`, which is four lines. What Helmet
 * genuinely buys you is server-side rendering, and bedrock does not render on
 * the server. If that changes, this is the module to replace, and it is one
 * module.
 *
 * Every tag it writes carries `data-bedrock-head`, so cleanup removes exactly
 * what this wrote and never a tag the application put in `index.html` by hand.
 */
import { useEffect } from "react";

/** Marks a tag as ours, so cleanup cannot remove an app's static tag. */
const OWNED_ATTR = "data-bedrock-head";

export interface DocumentHeadOptions {
  /** Page title. Combined with `titleTemplate` when both are given. */
  title?: string;
  /**
   * How the title is framed, with `%s` standing for `title` — usually
   * `"%s · My Site"`. Passing the site name here rather than concatenating at
   * every call site is what keeps one page from being the odd one out.
   */
  titleTemplate?: string;
  /** Meta description. Search results show roughly 155 characters of it. */
  description?: string;
  /**
   * Canonical URL for this page. Absolute.
   *
   * Worth setting on anything reachable at more than one URL — a filtered list
   * whose query string does not change the content, most obviously — because
   * otherwise search engines pick a winner themselves and split the ranking of
   * the ones they do not pick.
   */
  canonical?: string;
  /** Preview image, absolute. Relative URLs are ignored by most scrapers. */
  image?: string;
  /** `website`, `article`, `profile`. Defaults to `website`. */
  type?: string;
  /** Site name in the preview card, distinct from the page title. */
  siteName?: string;
  /**
   * Keeps the page out of search results while leaving it reachable. For a
   * staging deployment, or a page that is public but not worth indexing.
   */
  noIndex?: boolean;
}

function setMeta(attr: "name" | "property", key: string, value: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    tag.setAttribute(OWNED_ATTR, "");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", value);
}

function setLink(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    tag.setAttribute(OWNED_ATTR, "");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/** Build the tag set for a page. Exported for testing and for a future SSR path. */
export function documentHeadTags(options: DocumentHeadOptions): {
  title: string | null;
  meta: Array<{ attr: "name" | "property"; key: string; value: string }>;
  links: Array<{ rel: string; href: string }>;
} {
  const {
    title, titleTemplate, description, canonical, image,
    type = "website", siteName, noIndex,
  } = options;

  const resolvedTitle =
    title && titleTemplate ? titleTemplate.replace("%s", title) : title ?? null;

  const meta: Array<{ attr: "name" | "property"; key: string; value: string }> = [];
  const links: Array<{ rel: string; href: string }> = [];

  if (description) meta.push({ attr: "name", key: "description", value: description });
  if (noIndex) {
    // `noindex` alone still lets a crawler follow links out of the page, which
    // is usually what you want; `nofollow` as well would strand anything only
    // linked from here.
    meta.push({ attr: "name", key: "robots", value: "noindex" });
  }

  // Open Graph. The title here is the *page* title, unframed by the template —
  // a preview card renders the site name separately, and "Page · Site" beside
  // "Site" reads as a stutter.
  if (title) meta.push({ attr: "property", key: "og:title", value: title });
  if (description) {
    meta.push({ attr: "property", key: "og:description", value: description });
  }
  meta.push({ attr: "property", key: "og:type", value: type });
  if (siteName) meta.push({ attr: "property", key: "og:site_name", value: siteName });
  if (canonical) meta.push({ attr: "property", key: "og:url", value: canonical });
  if (image) meta.push({ attr: "property", key: "og:image", value: image });

  // Twitter reads most og: tags, but not the card type — without it a post
  // with an image renders as a bare link.
  meta.push({
    attr: "name", key: "twitter:card",
    value: image ? "summary_large_image" : "summary",
  });

  if (canonical) links.push({ rel: "canonical", href: canonical });

  return { title: resolvedTitle, meta, links };
}

/**
 * Set the document head for the current page.
 *
 * ```tsx
 * useDocumentHead({
 *   title: set.name,
 *   titleTemplate: "%s · RynoGuy",
 *   description: `Every card in ${set.name}.`,
 *   canonical: `https://rynoguy.com/sets/${set.id}`,
 *   image: set.coverUrl,
 * });
 * ```
 *
 * Values are applied on change and left in place on unmount. That is
 * deliberate: restoring the previous title as a route unmounts makes the
 * browser tab flicker back to the old page during the transition, and the next
 * route sets its own title a moment later anyway. A route that wants a page to
 * *not* be indexed sets `noIndex` rather than relying on teardown.
 */
export function useDocumentHead(options: DocumentHeadOptions): void {
  const {
    title, titleTemplate, description, canonical, image, type, siteName, noIndex,
  } = options;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const tags = documentHeadTags({
      title, titleTemplate, description, canonical, image, type, siteName, noIndex,
    });

    if (tags.title) document.title = tags.title;
    for (const m of tags.meta) setMeta(m.attr, m.key, m.value);
    for (const l of tags.links) setLink(l.rel, l.href);

    // Destructured rather than depending on `options`, which is an object
    // literal at every call site and would re-run this on every render.
  }, [title, titleTemplate, description, canonical, image, type, siteName, noIndex]);
}

/**
 * Remove every tag this module added. For tests, and for an application that
 * genuinely needs a clean head between routes.
 */
export function clearDocumentHead(): void {
  document.head
    .querySelectorAll(`[${OWNED_ATTR}]`)
    .forEach((el) => el.remove());
}
