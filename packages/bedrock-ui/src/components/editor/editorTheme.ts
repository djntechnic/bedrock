/**
 * @file editorTheme.ts
 * @description CodeMirror theme for `<HtmlCodeEditor>`, resolved entirely through
 * the semantic tokens in `styles/tokens.css` (§S009) so it follows the active
 * theme — including dark mode and custom themes — with no per-theme branch.
 */
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export const bedrockEditorTheme: Extension = EditorView.theme({
  "&": {
    color: "hsl(var(--foreground))",
    backgroundColor: "hsl(var(--muted) / 0.4)",
    fontSize: "0.875rem",
  },
  ".cm-content": {
    caretColor: "hsl(var(--primary))",
  },
  "&.cm-focused": {
    outline: "2px solid hsl(var(--ring) / 0.5)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "hsl(var(--primary))",
  },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.2)",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--accent) / 0.5)",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted))",
    color: "hsl(var(--muted-foreground))",
    borderRight: "1px solid hsl(var(--border))",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--accent))",
  },
  ".cm-tooltip": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy hsl(var(--destructive))",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy hsl(var(--warning))",
  },
});
