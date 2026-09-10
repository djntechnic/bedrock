export interface HelpPopoverProps {
    topic: string;
    variant?: "icon" | "button" | "subtle";
    align?: "center" | "start" | "end";
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
    triggerClassName?: string;
}
export default function HelpPopover({ topic, variant: _variant, align, side, className, triggerClassName, }: HelpPopoverProps): import("react").JSX.Element;
