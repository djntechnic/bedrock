/**
 * @file htmlLinter.ts
 * @description HTMLHint wired into `@codemirror/lint`.
 */
import { type Diagnostic } from "@codemirror/lint";
import type { Extension, Text } from "@codemirror/state";
import type { Ruleset } from "htmlhint/dist/core/types";
/**
 * Structural rules only. Style rules (attribute case, quote style) would flag
 * hand-tuned marketplace HTML that is valid as written.
 */
export declare const DEFAULT_HTML_LINT_RULES: Ruleset;
/** Pure core of the linter, split out so it can be tested without an editor view. */
export declare function lintHtmlDocument(doc: Text, rules?: Ruleset): Diagnostic[];
export declare function createHtmlLinterExtension(rules?: Ruleset): Extension;
