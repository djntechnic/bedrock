import { jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, Link2Off } from "lucide-react";
import { Button } from "../ui/button.js";
import AuthFlowCard from "./AuthFlowCard.js";
import { TOKEN_PARAM, confirmEmailVerification, messageFromError } from "./authFlowApi.js";
function VerifyEmailPage({
  continuePath = "/"
}) {
  const [params] = useSearchParams();
  const token = params.get(TOKEN_PARAM) ?? "";
  const [status, setStatus] = useState(token ? "verifying" : "failed");
  const [error, setError] = useState(
    token ? null : "This link is incomplete. Open it again from the original email."
  );
  const attempted = useRef(false);
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    confirmEmailVerification(token).then(() => setStatus("verified")).catch((err) => {
      setError(
        messageFromError(err, "We couldn't verify this address. Please try again.")
      );
      setStatus("failed");
    });
  }, [token]);
  if (status === "verifying") {
    return /* @__PURE__ */ jsx(
      AuthFlowCard,
      {
        icon: Loader2,
        iconClassName: "animate-spin",
        title: "Verifying your email…",
        description: "This will only take a moment."
      }
    );
  }
  if (status === "verified") {
    return /* @__PURE__ */ jsx(
      AuthFlowCard,
      {
        icon: CheckCircle2,
        tone: "success",
        title: "Email verified",
        description: "Thanks — your address is confirmed.",
        children: /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(Button, { asChild: true, children: /* @__PURE__ */ jsx(Link, { to: continuePath, children: "Continue" }) }) })
      }
    );
  }
  return /* @__PURE__ */ jsx(
    AuthFlowCard,
    {
      icon: Link2Off,
      tone: "destructive",
      title: "This link didn't work",
      description: error,
      children: /* @__PURE__ */ jsx("p", { className: "text-center text-sm text-muted-foreground", children: "Verification links expire. Sign in and request a new one from your account settings." })
    }
  );
}
export {
  VerifyEmailPage as default
};
//# sourceMappingURL=VerifyEmailPage.js.map
