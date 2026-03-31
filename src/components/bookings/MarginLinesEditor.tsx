import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MarginLineType, MarginLineSource, BookingMarginLine, AgencyMarginRule } from "@/types/margin";
import { findApplicableRule, applySuggestedMarkup } from "@/types/margin";

// ── Local line type for pre-save editing ────────────────────────────────
export interface LocalMarginLine {
  id: string;
  line_type: MarginLineType;
  description: string;
  source: MarginLineSource;
  quantity: number;
  unit_cost: number;
  unit_sell: number;
  is_pass_through: boolean;
  sort_order: number;
  // Preview-only computed fields (not source of truth)
  _preview_total_cost: number;
  _preview_total_sell: number;
  _preview_margin: number;
}

function computePreviewFields(line: Omit<LocalMarginLine, "_preview_total_cost" | "_preview_total_sell" | "_preview_margin">): LocalMarginLine {
  const totalCost = Math.round(line.quantity * line.unit_cost * 100) / 100;
  const totalSell = Math.round(line.quantity * line.unit_sell * 100) / 100;
  const margin = line.is_pass_through ? 0 : Math.round((totalSell - totalCost) * 100) / 100;
  return { ...line, _preview_total_cost: totalCost, _preview_total_sell: totalSell, _preview_margin: margin };
}

export function createEmptyLine(sortOrder: number): LocalMarginLine {
  return computePreviewFields({
    id: crypto.randomUUID(),
    line_type: "other",
    description: "",
    source: "manual",
    quantity: 1,
    unit_cost: 0,
    unit_sell: 0,
    is_pass_through: false,
    sort_order: sortOrder,
  });
}

export function fromDbLine(line: BookingMarginLine): LocalMarginLine {
  return {
    id: line.id,
    line_type: line.line_type,
    description: line.description,
    source: line.source as MarginLineSource,
    quantity: line.quantity,
    unit_cost: line.unit_cost,
    unit_sell: line.unit_sell,
    is_pass_through: line.is_pass_through,
    sort_order: line.sort_order,
    _preview_total_cost: line.total_cost,
    _preview_total_sell: line.total_sell,
    _preview_margin: line.margin_amount,
  };
}

const LINE_TYPE_OPTIONS: { value: MarginLineType; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "cruise", label: "Cruise" },
  { value: "transfer", label: "Transfer" },
  { value: "insurance", label: "Insurance" },
  { value: "service_fee", label: "Service Fee" },
  { value: "package", label: "Package" },
  { value: "excursion", label: "Excursion" },
  { value: "other", label: "Other" },
];

// ── Props ────────────────────────────────────────────────────────────────
interface MarginLinesEditorProps {
  lines: LocalMarginLine[];
  onChange: (lines: LocalMarginLine[]) => void;
  readOnly?: boolean;
  rules?: AgencyMarginRule[];
  supplierId?: string | null;
}

export function MarginLinesEditor({ lines, onChange, readOnly = false, rules = [], supplierId = null }: MarginLinesEditorProps) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

  const updateLine = (id: string, patch: Partial<LocalMarginLine>) => {
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...patch };
        return computePreviewFields(merged);
      })
    );
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((l) => l.id !== id).map((l, i) => ({ ...l, sort_order: i })));
  };

  const addLine = () => {
    onChange([...lines, createEmptyLine(lines.length)]);
  };

  // Preview totals
  const totalSell = lines.reduce((s, l) => s + l._preview_total_sell, 0);
  const totalCost = lines.filter((l) => !l.is_pass_through).reduce((s, l) => s + l._preview_total_cost, 0);
  const totalMargin = lines.reduce((s, l) => s + l._preview_margin, 0);
  const marginPct = totalSell > 0 ? (totalMargin / totalSell) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Margin Line Items</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Totals shown are previews. Final margin is calculated by the backend when saved.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Header */}
      <div className="hidden md:grid grid-cols-[100px_1fr_60px_90px_90px_80px_80px_60px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Type</span>
        <span>Description</span>
        <span>Qty</span>
        <span>Unit Cost</span>
        <span>Unit Sell</span>
        <span>Total Cost</span>
        <span>Margin</span>
        <span>Pass‑thru</span>
        <span />
      </div>

      {/* Lines */}
      {lines.map((line) => (
        <div
          key={line.id}
          className="grid grid-cols-1 md:grid-cols-[100px_1fr_60px_90px_90px_80px_80px_60px_32px] gap-2 items-center p-2 md:p-0 rounded-lg md:rounded-none bg-muted/30 md:bg-transparent"
        >
          <Select
            value={line.line_type}
            onValueChange={(v) => updateLine(line.id, { line_type: v as MarginLineType })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={line.description}
            onChange={(e) => updateLine(line.id, { description: e.target.value })}
            disabled={readOnly}
            placeholder="Description"
            className="h-8 text-sm"
          />

          <Input
            type="number"
            min="1"
            value={line.quantity}
            onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 1 })}
            disabled={readOnly}
            className="h-8 text-sm"
          />

          <Input
            type="number"
            min="0"
            step="0.01"
            value={line.unit_cost || ""}
            onChange={(e) => updateLine(line.id, { unit_cost: parseFloat(e.target.value) || 0 })}
            disabled={readOnly}
            placeholder="0.00"
            className="h-8 text-sm"
          />

          {/* Unit sell with optional rule suggestion */}
          <div className="relative col-span-1">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.unit_sell || ""}
              onChange={(e) => updateLine(line.id, { unit_sell: parseFloat(e.target.value) || 0 })}
              disabled={readOnly}
              placeholder="0.00"
              className="h-8 text-sm"
            />
            {(() => {
              if (readOnly || !rules.length || line.unit_cost <= 0 || line.unit_sell > 0) return null;
              const rule = findApplicableRule(rules, line.line_type, supplierId, "markup_pct") ||
                           findApplicableRule(rules, line.line_type, supplierId, "markup_flat");
              const suggested = applySuggestedMarkup(line.unit_cost, rule);
              if (!suggested) return null;
              return (
                <button
                  type="button"
                  className="absolute -bottom-5 left-0 text-[10px] text-blue-500 hover:text-blue-700 whitespace-nowrap"
                  onClick={() => updateLine(line.id, { unit_sell: suggested })}
                >
                  Suggest: ${suggested.toFixed(2)}
                </button>
              );
            })()}
            className="h-8 text-sm"
          />

          <span className="text-xs font-medium px-1 text-muted-foreground">
            {formatCurrency(line._preview_total_cost)}
          </span>

          <span className={`text-xs font-medium px-1 ${line._preview_margin >= 0 ? "text-foreground" : "text-destructive"}`}>
            {formatCurrency(line._preview_margin)}
          </span>

          <div className="flex justify-center">
            <Switch
              checked={line.is_pass_through}
              onCheckedChange={(v) => updateLine(line.id, { is_pass_through: v })}
              disabled={readOnly}
              className="scale-75"
            />
          </div>

          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => removeLine(line.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {/* Add button */}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addLine} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Add Line
        </Button>
      )}

      {/* Preview Totals */}
      {lines.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Preview — final values set by backend
          </Badge>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Total Sell</p>
              <p className="font-semibold">{formatCurrency(totalSell)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Cost</p>
              <p className="font-semibold">{formatCurrency(totalCost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Gross Margin ({marginPct.toFixed(1)}%)</p>
              <p className={`font-semibold ${totalMargin >= 0 ? "text-foreground" : "text-destructive"}`}>
                {formatCurrency(totalMargin)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Read-only display for saved margin lines ────────────────────────────
interface MarginLinesDisplayProps {
  lines: BookingMarginLine[];
}

export function MarginLinesDisplay({ lines }: MarginLinesDisplayProps) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

  if (lines.length === 0) return null;

  const totalSell = lines.reduce((s, l) => s + l.total_sell, 0);
  const totalCost = lines.filter((l) => !l.is_pass_through).reduce((s, l) => s + l.total_cost, 0);
  const totalMargin = lines.reduce((s, l) => s + l.margin_amount, 0);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Margin Line Items</Label>

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="text-xs shrink-0 capitalize">
                {line.line_type.replace("_", " ")}
              </Badge>
              <span className="text-sm truncate">{line.description}</span>
              {line.is_pass_through && (
                <Badge variant="secondary" className="text-xs shrink-0">Pass-thru</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0 text-sm">
              <span className="text-muted-foreground">{formatCurrency(line.total_sell)}</span>
              <span className={`font-medium ${line.margin_amount >= 0 ? "" : "text-destructive"}`}>
                {formatCurrency(line.margin_amount)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-2 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Total Sell</p>
          <p className="font-semibold">{formatCurrency(totalSell)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Total Cost</p>
          <p className="font-semibold">{formatCurrency(totalCost)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Gross Margin</p>
          <p className={`font-semibold ${totalMargin >= 0 ? "" : "text-destructive"}`}>
            {formatCurrency(totalMargin)}
          </p>
        </div>
      </div>
    </div>
  );
}
