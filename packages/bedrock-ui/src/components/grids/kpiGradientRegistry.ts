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

const policies: KpiGradientPolicy[] = [];

/**
 * Register an application KPI gradient policy function.
 */
export function registerKpiGradientPolicy(policy: KpiGradientPolicy): void {
  policies.push(policy);
}

/**
 * Resolve whether a column has a directional KPI gradient policy.
 * Evaluates registered policies in reverse order (last-registered wins).
 */
export function resolveKpiGradientPolicy(columnId: string): KpiGradientDirection | null {
  for (let i = policies.length - 1; i >= 0; i--) {
    const res = policies[i](columnId);
    if (res !== null && res !== undefined) {
      return res;
    }
  }
  return null;
}

/**
 * Test teardown helper to clear all registered policies.
 */
export function __clearKpiGradientPolicies(): void {
  policies.length = 0;
}
