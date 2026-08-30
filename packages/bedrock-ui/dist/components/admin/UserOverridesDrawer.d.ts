import React from "react";
interface UserAdminRecord {
    user_id: number;
    email: string;
    display_name?: string | null;
    roles?: string[];
    is_active: boolean;
    is_superuser?: boolean;
}
interface UserOverridesDrawerProps {
    user: UserAdminRecord | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}
export default function UserOverridesDrawer({ user, open, onOpenChange, }: UserOverridesDrawerProps): React.JSX.Element | null;
export {};
