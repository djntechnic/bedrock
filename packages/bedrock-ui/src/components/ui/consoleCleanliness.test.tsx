/**
 * @file consoleCleanliness.test.tsx
 * @description Regression cover for the primitives that warned at every
 *              consumer: `<AlertDialog>`'s dropped overlay ref (#13) and
 *              `<Select>`'s scroll-button keys (#27, re-filed as #37).
 *
 * Both defects were console noise, never broken behaviour, which is exactly why
 * they survived so long — every existing test passed throughout. So these tests
 * assert on the console itself. React attributes a key warning to the nearest
 * *consumer* component, so a warning raised in here is one a consumer spends an
 * afternoon hunting through its own `.map()` calls.
 *
 * On #37 specifically: the reported cause — that `<SelectContent>` renders its
 * `ScrollUp`/`Viewport`/`ScrollDown` triple "as an unkeyed array" — is wrong,
 * and the Select cases below are the evidence. Static JSX siblings compile to a
 * single `jsxs` call, which React treats as statically-known children and never
 * key-validates; only a genuine array reaches the check. That holds for the
 * `dist/` build too, which emits `jsxs` for the same triple. Keying them would
 * be a no-op against a warning they cannot raise.
 *
 * So the Select cases are not a fix under test. They pin the shapes a consumer
 * actually renders — inside a form, with a placeholder, with grouped and mapped
 * items — so that if this warning is ever observed again, it is attributable
 * somewhere other than here, and #27's mistake (closed as fixed, on a file that
 * had never been touched) cannot repeat in the other direction.
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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

const keyWarnings = () =>
  [...errors, ...warnings].filter((m) => /unique "key" prop/i.test(m));

describe("Select (#27, #37)", () => {
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
    expect(keyWarnings()).toEqual([]);
  });

  it("stays quiet inside a form, where Radix mounts its hidden native select", () => {
    // `isFormControl` flips on the presence of a form ancestor, mounting a
    // second element tree the standalone case never renders. That tree builds
    // its options from a Set — a real array, and so a real place for this
    // warning to come from.
    render(
      <form>
        <Select open name="status">
          <SelectTrigger aria-label="Status">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </form>,
    );

    expect(keyWarnings()).toEqual([]);
  });

  it("stays quiet with grouped and mapped items", () => {
    // The shape a consumer writes when the options come from data — and the
    // one whose own `.map()` gets audited first when this warning appears.
    render(
      <Select open defaultValue="draft">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Status</SelectLabel>
            {["draft", "completed"].map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    expect(keyWarnings()).toEqual([]);
  });
});
