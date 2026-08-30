import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { isAxiosError } from "axios";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import PageHeader from "../PageHeader.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useChangePassword } from "../../hooks/useProfile.js";
import UserAccessProfileView from "./UserAccessProfileView.js";
const MIN_PASSWORD_LENGTH = 8;
function Field({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground", children: label }),
    /* @__PURE__ */ jsx("span", { className: "text-sm text-foreground", children: value })
  ] });
}
function ProfilePage() {
  const { user } = useAuth();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [done, setDone] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    setDone(false);
    setLocalError("");
    if (next.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setLocalError("The two new passwords do not match.");
      return;
    }
    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          setDone(true);
          setCurrent("");
          setNext("");
          setConfirm("");
        }
      }
    );
  };
  const serverError = changePassword.isError ? isAxiosError(changePassword.error) && changePassword.error.response?.status === 401 ? "Current password is incorrect." : "Could not change the password. Try again." : "";
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsx(PageHeader, { title: "Profile", subtitle: "Your account and sign-in details." }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs(Card, { children: [
        /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs(CardTitle, { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-muted-foreground" }),
          "Account"
        ] }) }),
        /* @__PURE__ */ jsx(CardContent, { className: "flex flex-col gap-4", children: user ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Field, { label: "Display name", value: user.display_name || "—" }),
          /* @__PURE__ */ jsx(Field, { label: "Email", value: user.email }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground", children: "Roles" }),
            /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: user.roles.length > 0 ? user.roles.map((role) => /* @__PURE__ */ jsx(Badge, { variant: "secondary", children: role }, role)) : /* @__PURE__ */ jsx("span", { className: "text-sm text-muted-foreground", children: "None" }) })
          ] }),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Last sign-in",
              value: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"
            }
          )
        ] }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Not signed in." }) })
      ] }),
      /* @__PURE__ */ jsxs(Card, { children: [
        /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs(CardTitle, { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(KeyRound, { className: "h-4 w-4 text-muted-foreground" }),
          "Change password"
        ] }) }),
        /* @__PURE__ */ jsx(CardContent, { children: /* @__PURE__ */ jsxs("form", { className: "flex flex-col gap-4", onSubmit: submit, children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "current-password", children: "Current password" }),
            /* @__PURE__ */ jsx(
              Input,
              {
                id: "current-password",
                type: "password",
                autoComplete: "current-password",
                value: current,
                onChange: (e) => setCurrent(e.target.value),
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "new-password", children: "New password" }),
            /* @__PURE__ */ jsx(
              Input,
              {
                id: "new-password",
                type: "password",
                autoComplete: "new-password",
                value: next,
                onChange: (e) => setNext(e.target.value),
                required: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "confirm-password", children: "Confirm new password" }),
            /* @__PURE__ */ jsx(
              Input,
              {
                id: "confirm-password",
                type: "password",
                autoComplete: "new-password",
                value: confirm,
                onChange: (e) => setConfirm(e.target.value),
                required: true
              }
            )
          ] }),
          (localError || serverError) && /* @__PURE__ */ jsx("p", { role: "alert", className: "text-sm text-destructive", children: localError || serverError }),
          done && !localError && /* @__PURE__ */ jsx("p", { role: "status", className: "text-sm text-positive", children: "Password changed." }),
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(Button, { type: "submit", disabled: changePassword.isPending, children: changePassword.isPending ? "Saving…" : "Change password" }) })
        ] }) })
      ] })
    ] }),
    user?.user_id && /* @__PURE__ */ jsx(UserAccessProfileView, { userId: user.user_id })
  ] });
}
export {
  ProfilePage as default
};
//# sourceMappingURL=ProfilePage.js.map
