/**
 * @file collapsible.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Collapsible primitive (Radix wrapper). Follows the same
 *              import + data-slot conventions as the sibling Dialog / Sheet /
 *              AlertDialog wrappers so panels compose identically.
 */
import * as React from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
declare function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>): React.JSX.Element;
declare function CollapsibleTrigger({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>): React.JSX.Element;
declare function CollapsibleContent({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>): React.JSX.Element;
export { Collapsible, CollapsibleTrigger, CollapsibleContent };
