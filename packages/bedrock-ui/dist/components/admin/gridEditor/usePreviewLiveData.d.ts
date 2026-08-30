/**
 * @file usePreviewLiveData.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Hook for fetching live backend API data for grid previews inside the Grid Editor.
 */
import type { ApiEndpointBinding } from "./apiPreviewRegistry";
export interface PreviewLiveDataState {
    rows: Record<string, unknown>[];
    isLoading: boolean;
    isError: boolean;
    errorMessage: string | null;
    refetch: () => void;
}
export declare function usePreviewLiveData(binding: ApiEndpointBinding | null, params: Record<string, any>, enabled?: boolean): PreviewLiveDataState;
