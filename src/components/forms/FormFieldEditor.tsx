import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type IntakeField, type IntakeFieldType } from "@/lib/intakeForms";

interface Props {
  field: IntakeField;
  index: number;
  total: number;
  onChange: (patch: Partial<IntakeField>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function FormFieldEditor({ field, index, total, onChange, onRemove, onMove }: Props) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
          <Select
            value={field.type}
            onValueChange={(v) => {
              const type = v as IntakeFieldType;
              onChange({
                type,
                options: type === "dropdown" ? (field.options ?? ["Option 1", "Option 2"]) : undefined,
              });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move field up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move field down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove field">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Question label</Label>
            <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Placeholder</Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Help text</Label>
          <Input
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
          />
        </div>

        {field.type === "dropdown" && (
          <div className="space-y-2">
            <Label>Options (one per line)</Label>
            <textarea
              className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={(field.options ?? []).join("\n")}
              onChange={(e) => onChange({ options: e.target.value.split("\n") })}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id={`req-${field.id}`}
            checked={Boolean(field.required)}
            onCheckedChange={(c) => onChange({ required: c })}
          />
          <Label htmlFor={`req-${field.id}`} className="font-normal">
            Required
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}