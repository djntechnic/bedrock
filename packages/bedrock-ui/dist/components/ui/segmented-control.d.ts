interface SegmentedControlProps<T extends string> {
    options: {
        value: T;
        label: string;
    }[];
    value: T;
    onChange: (value: T) => void;
    size?: "sm" | "default";
    className?: string;
}
export declare function SegmentedControl<T extends string>({ options, value, onChange, size, className, }: SegmentedControlProps<T>): import("react").JSX.Element;
export {};
