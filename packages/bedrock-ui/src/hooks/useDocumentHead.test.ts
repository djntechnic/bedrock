/**
 * @file useDocumentHead.test.ts
 * @description Per-route document head (plan F5).
 *
 * Most of these assert the tag *set* through `documentHeadTags`, which is the
 * pure function underneath the hook — the DOM writing is four lines and the
 * decisions are all in what gets emitted.
 */
import { afterEach, describe, expect, it } from "vitest";
import { clearDocumentHead, documentHeadTags } from "./useDocumentHead";

afterEach(() => {
  clearDocumentHead();
});

function metaValue(
  tags: ReturnType<typeof documentHeadTags>,
  attr: "name" | "property",
  key: string,
): string | undefined {
  return tags.meta.find((m) => m.attr === attr && m.key === key)?.value;
}

describe("title", () => {
  it("frames the page title with the template", () => {
    const tags = documentHeadTags({ title: "1989 Upper Deck", titleTemplate: "%s · RynoGuy" });
    expect(tags.title).toBe("1989 Upper Deck · RynoGuy");
  });

  it("uses the bare title when there is no template", () => {
    expect(documentHeadTags({ title: "Sets" }).title).toBe("Sets");
  });

  it("leaves the title alone when none is given", () => {
    expect(documentHeadTags({ description: "x" }).title).toBeNull();
  });

  it("sends the unframed title to Open Graph", () => {
    // A preview card renders the site name separately; "Page · Site" beside
    // "Site" reads as a stutter.
    const tags = documentHeadTags({ title: "Sets", titleTemplate: "%s · RynoGuy" });
    expect(metaValue(tags, "property", "og:title")).toBe("Sets");
  });
});

describe("the preview card", () => {
  it("emits the Open Graph set", () => {
    const tags = documentHeadTags({
      title: "Sets",
      description: "Every set.",
      canonical: "https://rynoguy.com/sets",
      image: "https://rynoguy.com/og.png",
      siteName: "RynoGuy",
      type: "article",
    });
    expect(metaValue(tags, "property", "og:description")).toBe("Every set.");
    expect(metaValue(tags, "property", "og:url")).toBe("https://rynoguy.com/sets");
    expect(metaValue(tags, "property", "og:image")).toBe("https://rynoguy.com/og.png");
    expect(metaValue(tags, "property", "og:site_name")).toBe("RynoGuy");
    expect(metaValue(tags, "property", "og:type")).toBe("article");
  });

  it("defaults the type to website", () => {
    expect(metaValue(documentHeadTags({ title: "x" }), "property", "og:type")).toBe(
      "website",
    );
  });

  it("asks for a large card only when there is an image", () => {
    // Twitter reads most og: tags but not the card type; without it a post
    // with an image renders as a bare link.
    expect(
      metaValue(documentHeadTags({ image: "https://x/og.png" }), "name", "twitter:card"),
    ).toBe("summary_large_image");
    expect(metaValue(documentHeadTags({ title: "x" }), "name", "twitter:card")).toBe(
      "summary",
    );
  });

  it("omits image and url when they are not supplied", () => {
    const tags = documentHeadTags({ title: "x" });
    expect(metaValue(tags, "property", "og:image")).toBeUndefined();
    expect(metaValue(tags, "property", "og:url")).toBeUndefined();
  });
});

describe("canonical", () => {
  it("emits a link when given", () => {
    const tags = documentHeadTags({ canonical: "https://rynoguy.com/sets" });
    expect(tags.links).toContainEqual({
      rel: "canonical",
      href: "https://rynoguy.com/sets",
    });
  });

  it("emits nothing when absent", () => {
    expect(documentHeadTags({ title: "x" }).links).toEqual([]);
  });
});

describe("noIndex", () => {
  it("asks robots not to index", () => {
    expect(metaValue(documentHeadTags({ noIndex: true }), "name", "robots")).toBe(
      "noindex",
    );
  });

  it("does not also say nofollow", () => {
    // `nofollow` as well would strand anything only linked from this page.
    expect(metaValue(documentHeadTags({ noIndex: true }), "name", "robots")).not.toContain(
      "nofollow",
    );
  });

  it("is absent by default", () => {
    expect(metaValue(documentHeadTags({ title: "x" }), "name", "robots")).toBeUndefined();
  });
});

describe("cleanup", () => {
  it("removes only the tags this module wrote", () => {
    const appTag = document.createElement("meta");
    appTag.setAttribute("name", "theme-color");
    appTag.setAttribute("content", "#000");
    document.head.appendChild(appTag);

    const ours = document.createElement("meta");
    ours.setAttribute("name", "description");
    ours.setAttribute("data-bedrock-head", "");
    document.head.appendChild(ours);

    clearDocumentHead();

    expect(document.head.querySelector('meta[name="theme-color"]')).not.toBeNull();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });
});
