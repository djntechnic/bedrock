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
export declare function HtmlCodeEditor({ value, onChange, readOnly, showLineNumbers, showLintDiagnostics, height, className, onFormat, }: HtmlCodeEditorProps): import("react").JSX.Element;
