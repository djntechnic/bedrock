import { useEffect } from "react";
const OWNED_ATTR = "data-bedrock-head";
function setMeta(attr, key, value) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    tag.setAttribute(OWNED_ATTR, "");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", value);
}
function setLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    tag.setAttribute(OWNED_ATTR, "");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}
function documentHeadTags(options) {
  const {
    title,
    titleTemplate,
    description,
    canonical,
    image,
    type = "website",
    siteName,
    noIndex
  } = options;
  const resolvedTitle = title && titleTemplate ? titleTemplate.replace("%s", title) : title ?? null;
  const meta = [];
  const links = [];
  if (description) meta.push({ attr: "name", key: "description", value: description });
  if (noIndex) {
    meta.push({ attr: "name", key: "robots", value: "noindex" });
  }
  if (title) meta.push({ attr: "property", key: "og:title", value: title });
  if (description) {
    meta.push({ attr: "property", key: "og:description", value: description });
  }
  meta.push({ attr: "property", key: "og:type", value: type });
  if (siteName) meta.push({ attr: "property", key: "og:site_name", value: siteName });
  if (canonical) meta.push({ attr: "property", key: "og:url", value: canonical });
  if (image) meta.push({ attr: "property", key: "og:image", value: image });
  meta.push({
    attr: "name",
    key: "twitter:card",
    value: image ? "summary_large_image" : "summary"
  });
  if (canonical) links.push({ rel: "canonical", href: canonical });
  return { title: resolvedTitle, meta, links };
}
function useDocumentHead(options) {
  const {
    title,
    titleTemplate,
    description,
    canonical,
    image,
    type,
    siteName,
    noIndex
  } = options;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const tags = documentHeadTags({
      title,
      titleTemplate,
      description,
      canonical,
      image,
      type,
      siteName,
      noIndex
    });
    if (tags.title) document.title = tags.title;
    for (const m of tags.meta) setMeta(m.attr, m.key, m.value);
    for (const l of tags.links) setLink(l.rel, l.href);
  }, [title, titleTemplate, description, canonical, image, type, siteName, noIndex]);
}
function clearDocumentHead() {
  document.head.querySelectorAll(`[${OWNED_ATTR}]`).forEach((el) => el.remove());
}
export {
  clearDocumentHead,
  documentHeadTags,
  useDocumentHead
};
//# sourceMappingURL=useDocumentHead.js.map
