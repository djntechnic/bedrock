/**
 * @file editorFields.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Shared labelled field-row primitives for the Grid Editor panels
 *              (grid-level + column-level). Extracted so both panels render the
 *              same controls with zero duplication (§S1).
 */

import { HelpCircle } from "lucide-react";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";

// Radix Select disallows empty-string item values, so map "" ↔ a sentinel.
export const NONE = "__none__";

export function Row({ label, help, children }: {
  label: string; help?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground font-normal flex items-center gap-1">
        {label}
        {help && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-64">
                {help}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      {children}
    </div>
  );
}

export function SwitchRow({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <Row label={label}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </Row>
  );
}

export function NumberRow({ label, value, onChange, placeholder, disabled }: {
  label: string; value: number | undefined; onChange: (v: number) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <Row label={label}>
      <Input type="number" value={value ?? ""} placeholder={placeholder} disabled={disabled}
        className="h-8 w-28"
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
    </Row>
  );
}

export function TextRow({ label, value, onChange, placeholder, disabled, help }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; help?: React.ReactNode;
}) {
  return (
    <Row label={label} help={help}>
      <Input value={value} placeholder={placeholder} disabled={disabled} className="h-8 w-40"
        onChange={(e) => onChange(e.target.value)} />
    </Row>
  );
}

export function SelectRow({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <Row label={label}>
      <Select value={value === "" ? NONE : value} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
        <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || NONE} value={o.value === "" ? NONE : o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

export function ColorRow({ label, value, onChange, disabled }: {
  label: string; value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value ?? "#ffffff"}
          disabled={disabled}
          aria-label={`${label} color`}
          className="h-7 w-10 cursor-pointer rounded border bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          onChange={(e) => onChange(e.target.value)} />
        {value && !disabled && (
          <button type="button" aria-label={`Clear ${label} color`}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(null)}>✕</button>
        )}
      </div>
    </Row>
  );
}

export function TextAreaRow({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="w-full rounded border bg-transparent px-2 py-1 text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
