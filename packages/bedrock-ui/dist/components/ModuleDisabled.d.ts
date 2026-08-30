interface Props {
    reason: "role" | "module";
    required: string;
}
export default function ModuleDisabled({ reason, required }: Props): import("react").JSX.Element;
export {};
