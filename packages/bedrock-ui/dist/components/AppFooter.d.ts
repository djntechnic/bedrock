export interface AppFooterProps {
    /**
     * Short line beside the app name. Optional, and rendered only when given —
     * this was the literal string "Baseball Analytics Platform", which every
     * application built on this package would otherwise have shown in its
     * footer.
     */
    tagline?: string;
}
export default function AppFooter({ tagline }?: AppFooterProps): import("react").JSX.Element;
