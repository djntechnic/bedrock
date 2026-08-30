/** Mirrors the backend's `min_length=8` on `new_password`. */
export declare const MIN_PASSWORD_LENGTH = 8;
export interface SetPasswordPageProps {
    /**
     * Which copy to show. `invite` for a first password, `reset` for a
     * replacement. The request is byte-for-byte identical either way.
     */
    mode?: "invite" | "reset";
    /** Where "continue to sign in" goes. Apps that do not mount `/login` override it. */
    loginPath?: string;
}
export default function SetPasswordPage({ mode, loginPath, }: SetPasswordPageProps): import("react").JSX.Element;
