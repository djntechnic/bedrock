/**
 * @file ApiSpecPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Interactive API documentation surface for the Admin → Health
 *              "Spec" sub-tab. Renders an embedded Swagger UI instance pointed
 *              at the live backend OpenAPI specification and exposes one-click
 *              download anchors for the raw openapi.json and the committed
 *              Postman collection asset.
 */
/** Live OpenAPI specification served by FastAPI. */
export declare const OPENAPI_SPEC_URL: string;
/** Committed Postman collection asset served from the backend static mount. */
export declare const POSTMAN_COLLECTION_URL: string;
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
export default function ApiSpecPanel({ specUrl, postmanUrl, appName, }: ApiSpecPanelProps): import("react").JSX.Element;
