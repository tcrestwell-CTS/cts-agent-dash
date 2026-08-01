import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntakeField } from "@/lib/intakeForms";

interface Props {
  field: IntakeField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function IntakeFieldInput({ field, value, onChange, disabled }: Props) {
  const id = `field-${field.id}`;

  const control = () => {
    switch (field.type) {
      case "long_text":
        return (
          <Textarea
            id={id}
            rows={4}
            disabled={disabled}
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "dropdown":
        return (
          <Select
            disabled={disabled}
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).filter(Boolean).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              disabled={disabled}
              checked={Boolean(value)}
              onCheckedChange={(c) => onChange(Boolean(c))}
            />
            <Label htmlFor={id} className="font-normal">
              {field.placeholder || "Yes"}
            </Label>
          </div>
        );
      case "file":
        return (
          <Input
            id={id}
            type="file"
            disabled={disabled}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        );
      default:
        return (
          <Input
            id={id}
            type={
              field.type === "date"
                ? "date"
                : field.type === "number"
                  ? "number"
                  : field.type === "email"
                    ? "email"
                    : field.type === "phone"
                      ? "tel"
                      : "text"
            }
            disabled={disabled}
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      {field.type !== "checkbox" && (
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      {field.type === "checkbox" && (
        <Label className="block">
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      )}
      {control()}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}