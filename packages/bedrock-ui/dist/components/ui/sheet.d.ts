import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
declare const Sheet: React.FC<SheetPrimitive.DialogProps>;
declare const SheetTrigger: React.ForwardRefExoticComponent<SheetPrimitive.DialogTriggerProps & React.RefAttributes<HTMLButtonElement>>;
declare const SheetClose: React.ForwardRefExoticComponent<SheetPrimitive.DialogCloseProps & React.RefAttributes<HTMLButtonElement>>;
declare const SheetContent: React.ForwardRefExoticComponent<Omit<SheetPrimitive.DialogContentProps & React.RefAttributes<HTMLDivElement>, "ref"> & {
    side?: "top" | "right" | "bottom" | "left";
    showCloseButton?: boolean;
    showOverlay?: boolean;
} & React.RefAttributes<HTMLDivElement>>;
declare const SheetHeader: {
    ({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
    displayName: string;
};
declare const SheetFooter: {
    ({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
    displayName: string;
};
declare const SheetTitle: React.ForwardRefExoticComponent<Omit<SheetPrimitive.DialogTitleProps & React.RefAttributes<HTMLHeadingElement>, "ref"> & React.RefAttributes<HTMLHeadingElement>>;
declare const SheetDescription: React.ForwardRefExoticComponent<Omit<SheetPrimitive.DialogDescriptionProps & React.RefAttributes<HTMLParagraphElement>, "ref"> & React.RefAttributes<HTMLParagraphElement>>;
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, };
