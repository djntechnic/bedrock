export interface GlobalSearchBarProps {
    /**
     * Prompt text. The default is true of any application; an app that registers
     * entity search sources should name them — "Search players, teams, pages…"
     * is what this said unconditionally before it became a prop, in a package
     * with no players and no teams.
     */
    placeholder?: string;
}
export default function GlobalSearchBar({ placeholder, }?: GlobalSearchBarProps): import("react").JSX.Element;
