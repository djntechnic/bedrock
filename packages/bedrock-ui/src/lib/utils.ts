/**
 * @file utils.ts
 * @module frontend/src/lib
 * @description Shadcn/ui utility for tailwind class merging.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names and handles Tailwind CSS conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
