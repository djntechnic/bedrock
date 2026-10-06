import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WizardDialog, { type WizardStep } from "./WizardDialog";

const STEPS: WizardStep[] = [
  { id: "step1", label: "File", content: <div>File Content</div> },
  { id: "step2", label: "Map", content: <div>Map Content</div>, nextDisabled: true },
  { id: "step3", label: "Review", content: <div>Review Content</div> },
];

describe("WizardDialog", () => {
  it("renders steps, navigates forward/backward, and invokes finish", () => {
    const onStepChange = vi.fn();
    const onFinish = vi.fn();

    const { rerender } = render(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={0}
        onStepChange={onStepChange}
        onFinish={onFinish}
      />
    );

    expect(screen.getByText("File Content")).toBeDefined();
    const backBtn = screen.getByRole("button", { name: /Back/i });
    expect(backBtn).toBeDisabled();

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);
    expect(onStepChange).toHaveBeenCalledWith(1);

    // On step 2, nextDisabled is true
    rerender(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={1}
        onStepChange={onStepChange}
        onFinish={onFinish}
      />
    );
    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();

    // On step 3, finish button is rendered
    rerender(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={2}
        onStepChange={onStepChange}
        onFinish={onFinish}
        finishLabel="Import 42 items"
      />
    );
    const finishBtn = screen.getByRole("button", { name: "Import 42 items" });
    fireEvent.click(finishBtn);
    expect(onFinish).toHaveBeenCalled();
  });
});
