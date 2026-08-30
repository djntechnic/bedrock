interface GridStatusProps {
    type: "loading" | "error" | "empty";
    message?: string;
}
export declare function GridStatusContent({ type, message }: GridStatusProps): import("react").JSX.Element;
export declare function GridStatusRow({ type, message, colSpan, }: GridStatusProps & {
    colSpan?: number;
}): import("react").JSX.Element;
export {};
