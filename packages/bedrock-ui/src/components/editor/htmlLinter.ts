/**
 * @file htmlLinter.ts
 * @description HTMLHint wired into `@codemirror/lint`.
 */
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension, Text } from "@codemirror/state";
import { HTMLHint } from "htmlhint";
import type { Ruleset } from "htmlhint/dist/core/types";

/**
 * Structural rules only. Style rules (attribute case, quote style) would flag
 * hand-tuned marketplace HTML that is valid as written.
 */
export const DEFAULT_HTML_LINT_RULES: Ruleset = {
  "tagname-lowercase": true,
  "attr-lowercase": false,
  "attr-value-double-quotes": false,
  "tag-pair": true,
  "spec-char-escape": false,
  "id-unique": true,
  "src-not-empty": true,
  "attr-no-duplication": true,
};

/** Pure core of the linter, split out so it can be tested without an editor view. */
export function lintHtmlDocument(doc: Text, rules: Ruleset = DEFAULT_HTML_LINT_RULES): Diagnostic[] {
  const text = doc.toString();
  if (!text) return [];

  return HTMLHint.verify(text, rules).map((msg): Diagnostic => {
    const line = doc.line(Math.min(Math.max(msg.line, 1), doc.lines));
    const from = Math.min(line.from + Math.max(msg.col - 1, 0), line.to);
    const to = Math.min(Math.max(from + msg.raw.length, from + 1), doc.length);
    return {
      from,
      to,
      severity: msg.type === "error" ? "error" : "warning",
      message: msg.message,
    };
  });
}

export function createHtmlLinterExtension(rules: Ruleset = DEFAULT_HTML_LINT_RULES): Extension {
  return linter((view) => lintHtmlDocument(view.state.doc, rules));
}
