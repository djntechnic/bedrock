/**
 * @file switch.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Switch primitive (Radix wrapper).
 */
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
declare const Switch: React.ForwardRefExoticComponent<Omit<SwitchPrimitive.SwitchProps & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
export { Switch };
