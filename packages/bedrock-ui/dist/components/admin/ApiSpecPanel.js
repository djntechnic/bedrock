import { jsxs, jsx } from "react/jsx-runtime";
import { lazy, useEffect, Suspense } from "react";
import { FileJson, Download } from "lucide-react";
import { log } from "../../utils/logger.js";
import { getAuthToken } from "../../api/client.js";
const __vite_import_meta_env__ = {};
const SwaggerUI = lazy(async () => {
  try {
    await import(
      /* @vite-ignore */
      "swagger-ui-react/swagger-ui.css"
    );
  } catch {
  }
  return import("swagger-ui-react");
});
const API_ORIGIN = typeof import.meta !== "undefined" && __vite_import_meta_env__?.VITE_API_BASE_URL || "";
const OPENAPI_SPEC_URL = `${API_ORIGIN}/openapi.json`;
const POSTMAN_COLLECTION_URL = `${API_ORIGIN}/static/collections/app.postman_collection.json`;
const ACTION_CLASS = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function ApiSpecPanel({
  specUrl = OPENAPI_SPEC_URL,
  postmanUrl = POSTMAN_COLLECTION_URL,
  appName = "api"
}) {
  useEffect(() => {
    log.debug(
      {
        action: "ADMIN_SPEC_VIEW",
        gridId: "ADMIN_SPEC_VIEW",
        activeTab: "SPEC"
      },
      "Admin opened the interactive API spec (Swagger) workspace view."
    );
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3", children: [
      /* @__PURE__ */ jsx("p", { className: "mr-auto text-xs text-muted-foreground", children: "Interactive documentation for the live backend OpenAPI specification." }),
      /* @__PURE__ */ jsxs(
        "a",
        {
          href: specUrl,
          download: `${appName}.openapi.json`,
          className: ACTION_CLASS,
          children: [
            /* @__PURE__ */ jsx(FileJson, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "Export OpenAPI Spec"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "a",
        {
          href: postmanUrl,
          download: `${appName}.postman_collection.json`,
          className: ACTION_CLASS,
          children: [
            /* @__PURE__ */ jsx(Download, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "Export Postman Collection"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "swagger-ui-theme rounded-lg border border-border bg-background shadow-sm", children: /* @__PURE__ */ jsx(
      Suspense,
      {
        fallback: /* @__PURE__ */ jsx("p", { className: "p-6 text-sm text-muted-foreground", children: "Loading interactive API documentation…" }),
        children: /* @__PURE__ */ jsx(
          SwaggerUI,
          {
            url: specUrl,
            docExpansion: "none",
            requestInterceptor: (req) => {
              const token = getAuthToken();
              if (token && req) {
                req.headers = req.headers || {};
                req.headers["Authorization"] = `Bearer ${token}`;
              }
              return req;
            }
          }
        )
      }
    ) })
  ] });
}
export {
  OPENAPI_SPEC_URL,
  POSTMAN_COLLECTION_URL,
  ApiSpecPanel as default
};
//# sourceMappingURL=ApiSpecPanel.js.map
