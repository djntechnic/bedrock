/**
 * @file kpiGradientRegistry.ts
 * @module @djntechnic/bedrock-ui/components/grids
 * @description Extension point for automated directional KPI gradients (#67).
 *
 * Applications register a policy function that indicates whether lower values
 * are better for a given numeric column (e.g. ERA, WHIP, rank: lowerBetter = true;
 * OPS, HR, AVG: lowerBetter = false).
 */
export interface KpiGradientDirection {
    lowerBetter: boolean;
}
export type KpiGradientPolicy = (columnId: string) => KpiGradientDirection | null;
/**
 * Register an application KPI gradient policy function.
 */
export declare function registerKpiGradientPolicy(policy: KpiGradientPolicy): void;
/**
 * Resolve whether a column has a directional KPI gradient policy.
 * Evaluates registered policies in reverse order (last-registered wins).
 */
export declare function resolveKpiGradientPolicy(columnId: string): KpiGradientDirection | null;
/**
 * Test teardown helper to clear all registered policies.
 */
export declare function __clearKpiGradientPolicies(): void;
