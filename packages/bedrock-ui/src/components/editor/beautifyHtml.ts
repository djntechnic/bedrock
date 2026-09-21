/**
 * @file beautifyHtml.ts
 * @description Shared HTML formatter for `<HtmlCodeEditor>` and its consumers.
 *
 * Whitespace inside `<pre>` / `<code>` is significant and is left alone, and
 * `{{token}}` placeholders pass through as ordinary text.
 */
import { html as beautify } from "js-beautify";

export function beautifyHtml(content: string): string {
  if (!content) return content;
  return beautify(content, {
    indent_size: 2,
    indent_char: " ",
    max_preserve_newlines: 1,
    preserve_newlines: true,
    wrap_line_length: 120,
    unformatted: ["pre", "code"],
    end_with_newline: true,
  });
}
