import { linter } from "@codemirror/lint";
import { HTMLHint } from "htmlhint";
const DEFAULT_HTML_LINT_RULES = {
  "tagname-lowercase": true,
  "attr-lowercase": false,
  "attr-value-double-quotes": false,
  "tag-pair": true,
  "spec-char-escape": false,
  "id-unique": true,
  "src-not-empty": true,
  "attr-no-duplication": true
};
function lintHtmlDocument(doc, rules = DEFAULT_HTML_LINT_RULES) {
  const text = doc.toString();
  if (!text) return [];
  return HTMLHint.verify(text, rules).map((msg) => {
    const line = doc.line(Math.min(Math.max(msg.line, 1), doc.lines));
    const from = Math.min(line.from + Math.max(msg.col - 1, 0), line.to);
    const to = Math.min(Math.max(from + msg.raw.length, from + 1), doc.length);
    return {
      from,
      to,
      severity: msg.type === "error" ? "error" : "warning",
      message: msg.message
    };
  });
}
function createHtmlLinterExtension(rules = DEFAULT_HTML_LINT_RULES) {
  return linter((view) => lintHtmlDocument(view.state.doc, rules));
}
export {
  DEFAULT_HTML_LINT_RULES,
  createHtmlLinterExtension,
  lintHtmlDocument
};
//# sourceMappingURL=htmlLinter.js.map
