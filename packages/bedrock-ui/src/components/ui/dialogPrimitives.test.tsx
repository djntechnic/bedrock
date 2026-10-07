import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as AlertDialogPrimitive from "./alert-dialog";
import * as DialogPrimitive from "./dialog";
import * as SheetPrimitive from "./sheet";

describe("Modal overlay token compliance (S009)", () => {
  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in DialogOverlay", () => {
    const { container } = render(
      <DialogPrimitive.Dialog open>
        <DialogPrimitive.DialogOverlay data-testid="dialog-overlay" />
      </DialogPrimitive.Dialog>
    );
    const overlay = container.querySelector("[data-slot='dialog-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });

  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in AlertDialogOverlay", () => {
    const { container } = render(
      <AlertDialogPrimitive.AlertDialog open>
        <AlertDialogPrimitive.AlertDialogOverlay data-testid="alert-overlay" />
      </AlertDialogPrimitive.AlertDialog>
    );
    const overlay = container.querySelector("[data-slot='alert-dialog-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });

  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in SheetOverlay", () => {
    // SheetOverlay is not exported; SheetContent portals it into document.body.
    render(
      <SheetPrimitive.Sheet open>
        <SheetPrimitive.SheetContent>
          <SheetPrimitive.SheetTitle>Title</SheetPrimitive.SheetTitle>
          <SheetPrimitive.SheetDescription>Description</SheetPrimitive.SheetDescription>
        </SheetPrimitive.SheetContent>
      </SheetPrimitive.Sheet>
    );
    const overlay = document.body.querySelector("[data-slot='sheet-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });
});
