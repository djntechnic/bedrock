import { html } from "js-beautify";
function beautifyHtml(content) {
  if (!content) return content;
  return html(content, {
    indent_size: 2,
    indent_char: " ",
    max_preserve_newlines: 1,
    preserve_newlines: true,
    wrap_line_length: 120,
    unformatted: ["pre", "code"],
    end_with_newline: true
  });
}
export {
  beautifyHtml
};
//# sourceMappingURL=beautifyHtml.js.map
