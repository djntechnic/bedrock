import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck, Mail } from "lucide-react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import AuthFlowCard from "./AuthFlowCard.js";
import { requestPasswordReset, messageFromError } from "./authFlowApi.js";
function ForgotPasswordPage({
  loginPath = "/login"
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(messageFromError(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }
  if (sent) {
    return /* @__PURE__ */ jsx(
      AuthFlowCard,
      {
        icon: MailCheck,
        tone: "success",
        title: "Check your email",
        description: /* @__PURE__ */ jsxs(Fragment, { children: [
          "If an account exists for ",
          /* @__PURE__ */ jsx("strong", { children: email }),
          ", a reset link is on its way. The link expires shortly, so use it soon."
        ] }),
        children: /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(Button, { asChild: true, variant: "outline", children: /* @__PURE__ */ jsx(Link, { to: loginPath, children: "Back to sign in" }) }) })
      }
    );
  }
  return /* @__PURE__ */ jsx(
    AuthFlowCard,
    {
      icon: Mail,
      title: "Reset your password",
      description: "Enter your email address and we'll send you a link to set a new password.",
      children: /* @__PURE__ */ jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "reset-email", children: "Email address" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "reset-email",
              type: "email",
              autoComplete: "email",
              autoFocus: true,
              required: true,
              value: email,
              onChange: (e) => setEmail(e.target.value)
            }
          )
        ] }),
        error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "text-sm text-destructive", children: error }) : null,
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: submitting, children: submitting ? "Sending…" : "Send reset link" }),
        /* @__PURE__ */ jsx("div", { className: "text-center", children: /* @__PURE__ */ jsx(Button, { asChild: true, variant: "link", size: "sm", children: /* @__PURE__ */ jsx(Link, { to: loginPath, children: "Back to sign in" }) }) })
      ] })
    }
  );
}
export {
  ForgotPasswordPage as default
};
//# sourceMappingURL=ForgotPasswordPage.js.map
