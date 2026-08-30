/**
 * @file utils.ts
 * @module frontend/src/lib
 * @description Shadcn/ui utility for tailwind class merging.
 */
import { type ClassValue } from "clsx";
/**
 * Merges class names and handles Tailwind CSS conflict resolution.
 */
export declare function cn(...inputs: ClassValue[]): string;
