/**
 * @file editorFields.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Shared labelled field-row primitives for the Grid Editor panels
 *              (grid-level + column-level). Extracted so both panels render the
 *              same controls with zero duplication (§S1).
 */
export declare const NONE = "__none__";
export declare function Row({ label, help, children }: {
    label: string;
    help?: React.ReactNode;
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function SwitchRow({ label, checked, onChange, disabled }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}): import("react").JSX.Element;
export declare function NumberRow({ label, value, onChange, placeholder, disabled }: {
    label: string;
    value: number | undefined;
    onChange: (v: number) => void;
    placeholder?: string;
    disabled?: boolean;
}): import("react").JSX.Element;
export declare function TextRow({ label, value, onChange, placeholder, disabled, help }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    help?: React.ReactNode;
}): import("react").JSX.Element;
export declare function SelectRow({ label, value, options, onChange, disabled }: {
    label: string;
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (v: string) => void;
    disabled?: boolean;
}): import("react").JSX.Element;
export declare function ColorRow({ label, value, onChange, disabled }: {
    label: string;
    value: string | null | undefined;
    onChange: (v: string | null) => void;
    disabled?: boolean;
}): import("react").JSX.Element;
export declare function TextAreaRow({ label, value, onChange, placeholder, disabled }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
}): import("react").JSX.Element;
