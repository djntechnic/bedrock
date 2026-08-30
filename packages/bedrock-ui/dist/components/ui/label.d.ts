/**
 * @file label.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Label primitive (Radix wrapper).
 */
import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
declare const Label: React.ForwardRefExoticComponent<Omit<LabelPrimitive.LabelProps & React.RefAttributes<HTMLLabelElement>, "ref"> & React.RefAttributes<HTMLLabelElement>>;
export { Label };
