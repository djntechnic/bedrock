export interface AppSidebarProps {
    /**
     * Where the user block links. Defaults to `/profile`, which is where
     * `<ProfilePage>` is meant to be routed.
     *
     * Pass `null` if the app routes no profile screen at all: the block then
     * renders as plain text instead of a link into `No routes matched location`,
     * which is what it did for every app that had not built a profile screen of
     * its own.
     */
    profilePath?: string | null;
}
export default function AppSidebar({ profilePath }?: AppSidebarProps): import("react").JSX.Element | null;
