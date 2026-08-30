/**
 * @file sheet.tsx
 * @module frontend/src/components/ui
 * @description shadcn/ui Sheet (slide-over) primitive (Radix wrapper).
 */
"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { XIcon } from "lucide-react"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-slot="sheet-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants: Record<string, string> = {
  top: "inset-x-0 top-0 border-b data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10",
  bottom: "inset-x-0 bottom-0 border-t data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
  left: "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10",
  right: "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm border-l data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10",
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: "top" | "right" | "bottom" | "left"
    showCloseButton?: boolean
    showOverlay?: boolean
  }
>(({ className, children, side = "right", showCloseButton = true, showOverlay = true, ...props }, ref) => (
  <SheetPortal>
    {showOverlay && <SheetOverlay />}
    <SheetPrimitive.Content
      ref={ref}
      data-slot="sheet-content"
      data-side={side}
      className={cn(
        "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        sheetVariants[side],
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <SheetPrimitive.Close data-slot="sheet-close" asChild>
          <Button
            variant="ghost"
            className="absolute top-3 right-3"
            size="icon-sm"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="sheet-header"
    className={cn("flex flex-col gap-0.5 p-4", className)}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="sheet-footer"
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    data-slot="sheet-title"
    className={cn(
      "font-heading text-base font-medium text-foreground",
      className
    )}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    data-slot="sheet-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
