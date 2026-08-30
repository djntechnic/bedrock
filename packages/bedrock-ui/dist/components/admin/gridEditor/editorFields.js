import { jsx, jsxs } from "react/jsx-runtime";
import { HelpCircle } from "lucide-react";
import { Input } from "../../ui/input.js";
import { Switch } from "../../ui/switch.js";
import { Label } from "../../ui/label.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select.js";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip.js";
const NONE = "__none__";
function Row({ label, help, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
    /* @__PURE__ */ jsxs(Label, { className: "text-xs text-muted-foreground font-normal flex items-center gap-1", children: [
      label,
      help && /* @__PURE__ */ jsx(TooltipProvider, { delayDuration: 200, children: /* @__PURE__ */ jsxs(Tooltip, { children: [
        /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(HelpCircle, { className: "h-3 w-3 cursor-help shrink-0" }) }),
        /* @__PURE__ */ jsx(TooltipContent, { side: "top", className: "text-xs max-w-64", children: help })
      ] }) })
    ] }),
    children
  ] });
}
function SwitchRow({ label, checked, onChange, disabled }) {
  return /* @__PURE__ */ jsx(Row, { label, children: /* @__PURE__ */ jsx(Switch, { checked, onCheckedChange: onChange, disabled }) });
}
function NumberRow({ label, value, onChange, placeholder, disabled }) {
  return /* @__PURE__ */ jsx(Row, { label, children: /* @__PURE__ */ jsx(
    Input,
    {
      type: "number",
      value: value ?? "",
      placeholder,
      disabled,
      className: "h-8 w-28",
      onChange: (e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))
    }
  ) });
}
function TextRow({ label, value, onChange, placeholder, disabled, help }) {
  return /* @__PURE__ */ jsx(Row, { label, help, children: /* @__PURE__ */ jsx(
    Input,
    {
      value,
      placeholder,
      disabled,
      className: "h-8 w-40",
      onChange: (e) => onChange(e.target.value)
    }
  ) });
}
function SelectRow({ label, value, options, onChange, disabled }) {
  return /* @__PURE__ */ jsx(Row, { label, children: /* @__PURE__ */ jsxs(Select, { value: value === "" ? NONE : value, onValueChange: (v) => onChange(v === NONE ? "" : v), disabled, children: [
    /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", className: "w-40", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
    /* @__PURE__ */ jsx(SelectContent, { children: options.map((o) => /* @__PURE__ */ jsx(SelectItem, { value: o.value === "" ? NONE : o.value, children: o.label }, o.value || NONE)) })
  ] }) });
}
function ColorRow({ label, value, onChange, disabled }) {
  return /* @__PURE__ */ jsx(Row, { label, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "color",
        value: value ?? "#ffffff",
        disabled,
        "aria-label": `${label} color`,
        className: "h-7 w-10 cursor-pointer rounded border bg-transparent disabled:opacity-50 disabled:cursor-not-allowed",
        onChange: (e) => onChange(e.target.value)
      }
    ),
    value && !disabled && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "aria-label": `Clear ${label} color`,
        className: "text-xs text-muted-foreground hover:text-foreground",
        onClick: () => onChange(null),
        children: "✕"
      }
    )
  ] }) });
}
function TextAreaRow({ label, value, onChange, placeholder, disabled }) {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
    /* @__PURE__ */ jsx(Label, { className: "text-xs text-muted-foreground font-normal", children: label }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value,
        placeholder,
        disabled,
        rows: 3,
        className: "w-full rounded border bg-transparent px-2 py-1 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed",
        onChange: (e) => onChange(e.target.value)
      }
    )
  ] });
}
export {
  ColorRow,
  NONE,
  NumberRow,
  Row,
  SelectRow,
  SwitchRow,
  TextAreaRow,
  TextRow
};
//# sourceMappingURL=editorFields.js.map
