import { jsx, jsxs } from "react/jsx-runtime";
import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button.js";
function ModuleDisabled({ reason, required }) {
  const headline = reason === "role" ? "Role required" : "Feature not enabled for your account";
  const detail = reason === "role" ? `Access to this page requires the "${required}" role.` : `The "${required}" module is not enabled for your account. Your administrator can grant it in the admin console.`;
  return /* @__PURE__ */ jsx("div", { className: "min-h-[60vh] flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "max-w-md text-center space-y-4 p-6", children: [
    /* @__PURE__ */ jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted", children: /* @__PURE__ */ jsx(ShieldOff, { className: "h-7 w-7 text-muted-foreground", "aria-hidden": true }) }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: headline }),
    /* @__PURE__ */ jsx("p", { className: "text-muted-foreground", children: detail }),
    /* @__PURE__ */ jsx("div", { className: "flex justify-center gap-2 pt-2", children: /* @__PURE__ */ jsx(Button, { asChild: true, variant: "outline", children: /* @__PURE__ */ jsx(Link, { to: "/", children: "Return to dashboard" }) }) })
  ] }) });
}
export {
  ModuleDisabled as default
};
//# sourceMappingURL=ModuleDisabled.js.map
