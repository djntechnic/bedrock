import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Link2Off, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import AuthFlowCard from "./AuthFlowCard.js";
import { TOKEN_PARAM, completePasswordReset, messageFromError } from "./authFlowApi.js";
const MIN_PASSWORD_LENGTH = 8;
const COPY = {
  invite: {
    title: "Choose your password",
    description: "Set a password to finish setting up your account.",
    submit: "Create account",
    doneTitle: "You're all set",
    doneDescription: "Your account is ready. Sign in to get started."
  },
  reset: {
    title: "Set a new password",
    description: "Choose a new password for your account.",
    submit: "Update password",
    doneTitle: "Password updated",
    doneDescription: "Your password has been changed and every other session has been signed out."
  }
};
function SetPasswordPage({
  mode = "reset",
  loginPath = "/login"
}) {
  const [params] = useSearchParams();
  const token = params.get(TOKEN_PARAM) ?? "";
  const copy = COPY[mode];
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  if (!token) {
    return /* @__PURE__ */ jsx(
      AuthFlowCard,
      {
        icon: Link2Off,
        tone: "destructive",
        title: "This link is incomplete",
        description: "It may have been cut short by your email client. Open it again from the original message, or request a new one.",
        children: /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(Button, { asChild: true, variant: "outline", children: /* @__PURE__ */ jsx(Link, { to: "/forgot-password", children: "Request a new link" }) }) })
      }
    );
  }
  if (done) {
    return /* @__PURE__ */ jsx(
      AuthFlowCard,
      {
        icon: CheckCircle2,
        tone: "success",
        title: copy.doneTitle,
        description: copy.doneDescription,
        children: /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(Button, { asChild: true, children: /* @__PURE__ */ jsx(Link, { to: loginPath, children: "Continue to sign in" }) }) })
      }
    );
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await completePasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(
        messageFromError(err, "Something went wrong. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }
  return /* @__PURE__ */ jsx(AuthFlowCard, { icon: KeyRound, title: copy.title, description: copy.description, children: /* @__PURE__ */ jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, noValidate: true, children: [
    /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
      /* @__PURE__ */ jsx(Label, { htmlFor: "new-password", children: "New password" }),
      /* @__PURE__ */ jsx(
        Input,
        {
          id: "new-password",
          type: "password",
          autoComplete: "new-password",
          autoFocus: true,
          required: true,
          minLength: MIN_PASSWORD_LENGTH,
          value: password,
          onChange: (e) => setPassword(e.target.value),
          "aria-invalid": error != null
        }
      ),
      /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
        "At least ",
        MIN_PASSWORD_LENGTH,
        " characters."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
      /* @__PURE__ */ jsx(Label, { htmlFor: "confirm-password", children: "Confirm password" }),
      /* @__PURE__ */ jsx(
        Input,
        {
          id: "confirm-password",
          type: "password",
          autoComplete: "new-password",
          required: true,
          value: confirm,
          onChange: (e) => setConfirm(e.target.value),
          "aria-invalid": error != null
        }
      )
    ] }),
    error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "text-sm text-destructive", children: error }) : null,
    /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: submitting, children: submitting ? "Saving…" : copy.submit })
  ] }) });
}
export {
  MIN_PASSWORD_LENGTH,
  SetPasswordPage as default
};
//# sourceMappingURL=SetPasswordPage.js.map
