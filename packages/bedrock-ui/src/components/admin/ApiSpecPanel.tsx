/**
 * @file ApiSpecPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Interactive API documentation surface for the Admin → Health
 *              "Spec" sub-tab. Renders an embedded Swagger UI instance pointed
 *              at the live backend OpenAPI specification and exposes one-click
 *              download anchors for the raw openapi.json and the committed
 *              Postman collection asset.
 */

import { lazy, Suspense, useEffect } from "react";
import { Download, FileJson } from "lucide-react";
import { log } from "../../utils/logger";
import { getAuthToken } from "../../api/client";
// Swagger UI is a heavy, CommonJS-flavoured dependency. Load it lazily so it
// stays out of the main bundle (and the module graph of unrelated tests) until
// the Spec tab is actually opened.
const SwaggerUI = lazy(async () => {
  try {
    await import(/* @vite-ignore */ "swagger-ui-react/swagger-ui.css");
  } catch {
    // Stylesheet optional if peer dependency is omitted
  }
  return import("swagger-ui-react");
});

/**
 * Origin of the backend. In production `VITE_API_BASE_URL` is set to
 * the deployed API origin; locally the dev server proxies `/api` but not
 * `/openapi.json` or `/static`, so consumers may supply a custom origin.
 */
const API_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

/** Live OpenAPI specification served by FastAPI. */
export const OPENAPI_SPEC_URL = `${API_ORIGIN}/openapi.json`;

/** Committed Postman collection asset served from the backend static mount. */
export const POSTMAN_COLLECTION_URL = `${API_ORIGIN}/static/collections/app.postman_collection.json`;

/** Shared class list for the download action anchors. */
const ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background " +
  "px-3 py-1.5 text-xs font-medium text-foreground transition-colors " +
  "hover:bg-muted hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface ApiSpecPanelProps {
  /** Override live OpenAPI spec URL. Defaults to `${VITE_API_BASE_URL}/openapi.json` or `/openapi.json`. */
  specUrl?: string;
  /** Override Postman collection URL. Defaults to `${VITE_API_BASE_URL}/static/collections/app.postman_collection.json`. */
  postmanUrl?: string;
  /** Application name prefix for download filenames (e.g. "mlbtracker", "collectit"). */
  appName?: string;
}

/**
 * Renders the interactive API spec workspace: an action bar of static-snapshot
 * download anchors above a theme-matched, embedded Swagger UI frame.
 */
export default function ApiSpecPanel({
  specUrl = OPENAPI_SPEC_URL,
  postmanUrl = POSTMAN_COLLECTION_URL,
  appName = "api",
}: ApiSpecPanelProps) {
  // Log tab activation — this component only mounts while the Spec tab is
  // active, so mount is equivalent to activation.
  useEffect(() => {
    log.debug(
      {
        action: "ADMIN_SPEC_VIEW",
        gridId: "ADMIN_SPEC_VIEW",
        activeTab: "SPEC",
      },
      "Admin opened the interactive API spec (Swagger) workspace view.",
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Action bar — static schema snapshot downloads */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <p className="mr-auto text-xs text-muted-foreground">
          Interactive documentation for the live backend OpenAPI specification.
        </p>
        <a
          href={specUrl}
          download={`${appName}.openapi.json`}
          className={ACTION_CLASS}
        >
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          Export OpenAPI Spec
        </a>
        <a
          href={postmanUrl}
          download={`${appName}.postman_collection.json`}
          className={ACTION_CLASS}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export Postman Collection
        </a>
      </div>

      {/* Documentation frame — theme-matched shadow container */}
      <div className="swagger-ui-theme rounded-lg border border-border bg-background shadow-sm">
        <Suspense
          fallback={
            <p className="p-6 text-sm text-muted-foreground">
              Loading interactive API documentation…
            </p>
          }
        >
          <SwaggerUI
            url={specUrl}
            docExpansion="none"
            requestInterceptor={(req) => {
              const token = getAuthToken();
              if (token && req) {
                req.headers = req.headers || {};
                req.headers["Authorization"] = `Bearer ${token}`;
              }
              return req;
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
