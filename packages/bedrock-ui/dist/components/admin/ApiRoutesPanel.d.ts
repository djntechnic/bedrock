/**
 * @file ApiRoutesPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description API Routes Explorer panel backed by GET /api/v1/admin/api-health.
 *              Surfaces operational telemetry cards, parameter tables, request body schemas,
 *              response types, and documentation status badges with real-time text and undocumented-only filters.
 */
import { type ApiHealthEntry } from "../../hooks/useAdminPlatform";
export interface ApiRoutesPanelProps {
    /** Optional pre-fetched routes list. If omitted, fetched via useApiHealth(). */
    routes?: ApiHealthEntry[];
    /** Optional loading state override. */
    isLoading?: boolean;
}
export declare function methodColor(m: string): string;
export default function ApiRoutesPanel({ routes: propRoutes, isLoading: propLoading, }: ApiRoutesPanelProps): import("react").JSX.Element;
