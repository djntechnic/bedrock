/**
 * @file conditionalFormat.ts
 * @module frontend/src/utils
 * @description Logic for mapping statistical values to CSS classes based on admin rules.
 */

import { logger } from "../lib/logger";
import type { StatBadgeVariant } from "../components/ui/stat-badge";

export interface ConditionalRule {
  /** Comparison operator. */
  op: "gte" | "gt" | "lte" | "lt" | "eq" | "between";
  /** Reference value for single-value operators. */
  value?: number;
  /** Minimum value for 'between' operator. */
  min?: number;
  /** Maximum value for 'between' operator. */
  max?: number;
  /** Tailwind color name mapping. */
  color: string;
}

/**
 * Evaluates a set of JSON rules against a numeric value and returns the matching CSS class.
 * Map color name to Tailwind text color classes (emerald, rose, amber, blue).
 *
 * @param value - The numeric value to evaluate.
 * @param rulesJson - Stringified JSON array of ConditionalRule objects.
 * @returns Tailwind CSS classes or an empty string if no rules match.
 */
export function getConditionalClass(
  value: any,
  rulesJson: string | null | undefined
): string {
  if (!rulesJson || value === null || value === undefined) return "";

  try {
    const rules: ConditionalRule[] = JSON.parse(rulesJson);
    const numValue = Number(value);
    if (isNaN(numValue)) return "";

    for (const rule of rules) {
      let match = false;
      switch (rule.op) {
        case "gte": match = numValue >= (rule.value ?? 0); break;
        case "gt":  match = numValue > (rule.value ?? 0); break;
        case "lte": match = numValue <= (rule.value ?? 0); break;
        case "lt":  match = numValue < (rule.value ?? 0); break;
        case "eq":  match = numValue === (rule.value ?? 0); break;
        case "between":
          match = numValue >= (rule.min ?? 0) && numValue <= (rule.max ?? 0);
          break;
      }

      if (match) {
        switch (rule.color) {
          case "emerald": return "text-teal-700 dark:text-teal-400 font-medium";
          case "rose":    return "text-red-700 dark:text-red-400 font-medium";
          case "amber":   return "text-orange-600 dark:text-orange-400 font-medium";
          case "blue":    return "text-blue-700 dark:text-blue-400 font-medium";
          default:        return "";
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to parse conditional format rules", { error: e });
  }

  return "";
}

/**
 * Evaluates conditional format rules and returns a `StatBadgeVariant` name,
 * or `null` when no rule matches.
 *
 * Maps color names: emerald → "positive", rose → "negative", amber → "warning", blue → "neutral".
 */
export function getConditionalVariant(
  value: any,
  rulesJson: string | null | undefined,
): StatBadgeVariant | null {
  if (!rulesJson || value === null || value === undefined) return null;

  try {
    const rules: ConditionalRule[] = JSON.parse(rulesJson);
    const numValue = Number(value);
    if (isNaN(numValue)) return null;

    for (const rule of rules) {
      let match = false;
      switch (rule.op) {
        case "gte": match = numValue >= (rule.value ?? 0); break;
        case "gt":  match = numValue >  (rule.value ?? 0); break;
        case "lte": match = numValue <= (rule.value ?? 0); break;
        case "lt":  match = numValue <  (rule.value ?? 0); break;
        case "eq":  match = numValue === (rule.value ?? 0); break;
        case "between":
          match = numValue >= (rule.min ?? 0) && numValue <= (rule.max ?? 0);
          break;
      }
      if (match) {
        switch (rule.color) {
          case "emerald": return "positive";
          case "rose":    return "negative";
          case "amber":   return "warning";
          case "blue":    return "neutral";
          default:        return null;
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to parse conditional format rules", { error: e });
  }

  return null;
}
