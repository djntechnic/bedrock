/**
 * @file AuthFlowCard.tsx
 * @module @djntechnic/bedrock-ui/components/auth
 * @description Centred card shell shared by the mail-flow pages (F1).
 *
 * Exists because the three pages are the same page with different copy, and
 * §S1 says repeated UI becomes a component the second time it is written, not
 * the fourth. It is layout only — no state, no data — so a page keeps its own
 * behaviour and only borrows the frame.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
export interface AuthFlowCardProps {
    icon: LucideIcon;
    title: string;
    /** One line under the title. Optional — the success states often say it all in the title. */
    description?: ReactNode;
    children?: ReactNode;
    /**
     * Tints the icon. `destructive` for a dead link, `success` for a completed
     * flow. Both resolve through tokens; §S9 forbids a literal colour here.
     */
    tone?: "default" | "success" | "destructive";
    /** Extra classes on the icon itself — `animate-spin` for a pending state. */
    iconClassName?: string;
}
export default function AuthFlowCard({ icon: Icon, title, description, children, tone, iconClassName, }: AuthFlowCardProps): import("react").JSX.Element;
