import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import Stepper from "./Stepper";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  nextDisabled?: boolean;
  nextLabel?: string;
}

export interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  steps: WizardStep[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  onFinish: () => void;
  finishLabel?: string;
  busy?: boolean;
  className?: string;
}

export default function WizardDialog({
  open,
  onOpenChange,
  title,
  description,
  steps,
  stepIndex,
  onStepChange,
  onFinish,
  finishLabel = "Finish",
  busy = false,
  className,
}: WizardDialogProps) {
  const currentStep = steps[stepIndex] ?? steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? `Step ${stepIndex + 1} of ${steps.length}: ${currentStep.label}`}
          </DialogDescription>
          <Stepper
            steps={steps.map((s) => s.label)}
            current={stepIndex}
            className="mt-2"
          />
        </DialogHeader>

        <div
          data-testid="wizard-step-body"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-2"
        >
          {currentStep.content}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFirst || busy}
              onClick={() => onStepChange(stepIndex - 1)}
            >
              Back
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={Boolean(currentStep.nextDisabled) || busy}
              onClick={() => {
                if (isLast) {
                  onFinish();
                } else {
                  onStepChange(stepIndex + 1);
                }
              }}
            >
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isLast ? finishLabel : (currentStep.nextLabel ?? "Next")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
