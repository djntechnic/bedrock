import { jsx } from "react/jsx-runtime";
import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView, keymap } from "@codemirror/view";
import { cn } from "../../lib/utils.js";
import { beautifyHtml } from "./beautifyHtml.js";
import { bedrockEditorTheme } from "./editorTheme.js";
import { createHtmlLinterExtension } from "./htmlLinter.js";
function HtmlCodeEditor({
  value,
  onChange,
  readOnly = true,
  showLineNumbers = true,
  showLintDiagnostics = true,
  height = "100%",
  className,
  onFormat
}) {
  const extensions = useMemo(() => {
    const exts = [html(), bedrockEditorTheme, EditorView.lineWrapping];
    if (showLintDiagnostics) exts.push(createHtmlLinterExtension());
    if (!readOnly && onFormat) {
      exts.push(
        keymap.of([
          {
            key: "Shift-Alt-f",
            run: (view) => {
              onFormat(beautifyHtml(view.state.doc.toString()));
              return true;
            }
          }
        ])
      );
    }
    return exts;
  }, [readOnly, showLintDiagnostics, onFormat]);
  return /* @__PURE__ */ jsx("div", { className: cn("overflow-hidden rounded-lg border border-border", className), children: /* @__PURE__ */ jsx(
    CodeMirror,
    {
      value,
      height,
      readOnly,
      editable: !readOnly,
      extensions,
      basicSetup: {
        lineNumbers: showLineNumbers,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        autocompletion: !readOnly
      },
      onChange
    }
  ) });
}
export {
  HtmlCodeEditor
};
//# sourceMappingURL=HtmlCodeEditor.js.map
