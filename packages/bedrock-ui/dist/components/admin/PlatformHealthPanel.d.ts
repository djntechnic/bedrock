/** Bytes as the operator reads them — the API returns raw bytes. */
export declare function formatBytes(bytes: number): string;
export interface PlatformHealthPanelProps {
    /** Initial active sub-tab. Defaults to "overview". */
    defaultSection?: "overview" | "routes" | "spec";
    /** Optional application name prefix for schema exports. */
    appName?: string;
    /** Optional custom OpenAPI spec URL. */
    specUrl?: string;
    /** Optional custom Postman collection URL. */
    postmanUrl?: string;
}
export default function PlatformHealthPanel({ defaultSection, appName, specUrl, postmanUrl, }?: PlatformHealthPanelProps): import("react").JSX.Element;
