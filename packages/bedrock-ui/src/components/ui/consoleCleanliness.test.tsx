/**
 * @file consoleCleanliness.test.tsx
 * @description Regression cover for the primitives that warned at every
 *              consumer: `<AlertDialog>`'s dropped overlay ref (#13) and
 *              `<Select>`'s scroll-button keys (#27).
 *
 * Both defects were console noise, never broken behaviour, which is exactly why
 * they survived so long — every existing test passed throughout. So these tests
 * assert on the console itself. React attributes a key warning to the nearest
 * *consumer* component, so a warning raised in here is one a consumer spends an
 * afternoon hunting through its own `.map()` calls.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

let errors: string[];
let warnings: string[];

beforeEach(() => {
  errors = [];
  warnings = [];
  // React routes both `forwardRef` and `key` warnings through console.error;
  // console.warn is captured too so a future deprecation cannot slip past.
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AlertDialog (#13)", () => {
  it("renders an open dialog without a forwardRef warning", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              The SKU stays reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Void</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByText("Void this listing?")).toBeTruthy();
    // The overlay is the component that took the ref, so a failure here names
    // it directly rather than leaving a bare count.
    expect([...errors, ...warnings].filter((m) => /cannot be given refs/i.test(m))).toEqual([]);
  });
});

describe("Select (#27)", () => {
  it("renders open content without a missing-key warning", () => {
    render(
      <Select open defaultValue="draft">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>,
    );

    // Two matches on purpose: the trigger echoes the selected item's label.
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect([...errors, ...warnings].filter((m) => /unique "key" prop/i.test(m))).toEqual([]);
  });
});
