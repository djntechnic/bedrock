/**
 * @file HtmlCodeEditor.tsx
 * @description Syntax-highlighted HTML editor with live lint diagnostics.
 *
 * Read-only by default: a consumer showing generated output opts in to editing
 * rather than out of it. Format on demand with `beautifyHtml`, or press
 * Shift-Alt-F inside the editor to format and receive the result via `onFormat`.
 */
import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView, keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { cn } from "../../lib/utils";
import { beautifyHtml } from "./beautifyHtml";
import { bedrockEditorTheme } from "./editorTheme";
import { createHtmlLinterExtension } from "./htmlLinter";

export interface HtmlCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  showLintDiagnostics?: boolean;
  height?: string;
  className?: string;
  /** Called with the formatted document when the user presses Shift-Alt-F. */
  onFormat?: (formattedValue: string) => void;
}

export function HtmlCodeEditor({
  value,
  onChange,
  readOnly = true,
  showLineNumbers = true,
  showLintDiagnostics = true,
  height = "100%",
  className,
  onFormat,
}: HtmlCodeEditorProps) {
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [html(), bedrockEditorTheme, EditorView.lineWrapping];
    if (showLintDiagnostics) exts.push(createHtmlLinterExtension());
    if (!readOnly && onFormat) {
      exts.push(
        keymap.of([
          {
            key: "Shift-Alt-f",
            run: (view) => {
              onFormat(beautifyHtml(view.state.doc.toString()));
              return true;
            },
          },
        ]),
      );
    }
    return exts;
  }, [readOnly, showLintDiagnostics, onFormat]);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <CodeMirror
        value={value}
        height={height}
        readOnly={readOnly}
        editable={!readOnly}
        extensions={extensions}
        basicSetup={{
          lineNumbers: showLineNumbers,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          autocompletion: !readOnly,
        }}
        onChange={onChange}
      />
    </div>
  );
}
