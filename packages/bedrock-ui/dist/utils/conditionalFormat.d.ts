/**
 * @file conditionalFormat.ts
 * @module frontend/src/utils
 * @description Logic for mapping statistical values to CSS classes based on admin rules.
 */
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
export declare function getConditionalClass(value: any, rulesJson: string | null | undefined): string;
/**
 * Evaluates conditional format rules and returns a `StatBadgeVariant` name,
 * or `null` when no rule matches.
 *
 * Maps color names: emerald → "positive", rose → "negative", amber → "warning", blue → "neutral".
 */
export declare function getConditionalVariant(value: any, rulesJson: string | null | undefined): StatBadgeVariant | null;
