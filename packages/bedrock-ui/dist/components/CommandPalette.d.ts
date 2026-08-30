import { type CommandRouteItem } from "../lib/commandRoutes";
/**
 * Rendering order for the static-route groups: first appearance in the
 * registered route list.
 *
 * This was a hardcoded array of MLBTracker's group names — "Leaderboards",
 * "Rankings", "Trends", "Inventory". A second application's groups would have
 * matched none of them, and its entire static-route section would have
 * rendered empty while every route was registered and findable. Registration
 * order is what `commandRoutes.ts` already documents, and it is stable across
 * restarts because the app registers in a fixed order.
 */
export declare function groupOrder(items: CommandRouteItem[]): CommandRouteItem["group"][];
export interface CommandPaletteProps {
    /**
     * Prompt text, matching whatever the app's `GlobalSearchBar` shows. Same
     * reasoning as that prop: the default names nothing this package does not
     * have.
     */
    placeholder?: string;
}
export default function CommandPalette({ placeholder, }?: CommandPaletteProps): import("react").JSX.Element;
