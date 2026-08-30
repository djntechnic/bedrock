import { jsx } from "react/jsx-runtime";
import { Toaster as Toaster$1 } from "sonner";
function Toaster({ isDark = false, ...props }) {
  return /* @__PURE__ */ jsx(
    Toaster$1,
    {
      theme: isDark ? "dark" : "light",
      position: "bottom-right",
      richColors: true,
      closeButton: true,
      ...props
    }
  );
}
export {
  Toaster
};
//# sourceMappingURL=sonner.js.map
