/**
 * @file tabs.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Tabs primitive (Radix wrapper).
 */
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
declare function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>): React.JSX.Element;
declare function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element;
declare function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element;
declare function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element;
export { Tabs, TabsList, TabsTrigger, TabsContent };
