/**
 * @file test-utils.tsx
 * @module @djntechnic/bedrock-ui/test
 * @description Testing-library render helpers wrapping grid providers.
 */
import { type ReactElement } from "react";
import { type RenderOptions } from "@testing-library/react";
import { type AuthContextValue } from "../context/AuthContext";
export declare function ensureDomMocks(): void;
export interface RenderGridOptions extends RenderOptions {
    auth?: Partial<AuthContextValue>;
    route?: string;
}
export declare function renderWithGridProviders(ui: ReactElement, options?: RenderGridOptions): import("@testing-library/react").RenderResult<typeof import("@testing-library/dom/types/queries"), HTMLElement, HTMLElement>;
export * from "@testing-library/react";
