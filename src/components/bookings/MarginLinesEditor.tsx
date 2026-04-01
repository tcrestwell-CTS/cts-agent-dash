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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, GripVertical, Info, Ship, Wifi, Wine, DollarSign, Anchor, ChevronDown, UtensilsCrossed, Sparkles } from "lucide-react";
import { DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
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

// ── Cruise Add-on Templates ─────────────────────────────────────────────
interface CruiseAddon {
  label: string;
  icon: React.ReactNode;
  items: Omit<LocalMarginLine, "id" | "sort_order" | "_preview_total_cost" | "_preview_total_sell" | "_preview_margin">[];
}

interface CruiseLineGroup {
  name: string;
  icon: React.ReactNode;
  addons: CruiseAddon[];
}

const CRUISE_LINE_ADDONS: CruiseLineGroup[] = [
  {
    name: "Carnival",
    icon: <Ship className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "CHEERS! Drink Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "CHEERS! Drink Package (per adult)", source: "manual", quantity: 1, unit_cost: 335.76, unit_sell: 335.76, is_pass_through: true }],
      },
      {
        label: "Wi-Fi — Social",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Social Wi-Fi (4-day)", source: "manual", quantity: 1, unit_cost: 51.00, unit_sell: 51.00, is_pass_through: true }],
      },
      {
        label: "Wi-Fi — Value",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Value Wi-Fi (4-day)", source: "manual", quantity: 1, unit_cost: 68.00, unit_sell: 68.00, is_pass_through: true }],
      },
      {
        label: "Wi-Fi — Premium",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Premium Wi-Fi (4-day)", source: "manual", quantity: 1, unit_cost: 78.20, unit_sell: 78.20, is_pass_through: true }],
      },
      {
        label: "Gratuities",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Auto Gratuities ($16/day × 4 days)", source: "manual", quantity: 1, unit_cost: 64.00, unit_sell: 64.00, is_pass_through: true }],
      },
    ],
  },
  {
    name: "Royal Caribbean",
    icon: <Anchor className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "Deluxe Beverage Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Deluxe Beverage Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 89.00, unit_sell: 89.00, is_pass_through: true }],
      },
      {
        label: "Refreshment Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Refreshment Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 38.00, unit_sell: 38.00, is_pass_through: true }],
      },
      {
        label: "VOOM Surf — 1 Device",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "VOOM Surf 1-Device (per day)", source: "manual", quantity: 1, unit_cost: 21.99, unit_sell: 21.99, is_pass_through: true }],
      },
      {
        label: "VOOM Surf + Stream — 1 Device",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "VOOM Surf+Stream 1-Device (per day)", source: "manual", quantity: 1, unit_cost: 25.99, unit_sell: 25.99, is_pass_through: true }],
      },
      {
        label: "Gratuities",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Auto Gratuities ($18.50/day)", source: "manual", quantity: 1, unit_cost: 18.50, unit_sell: 18.50, is_pass_through: true }],
      },
    ],
  },
  {
    name: "Norwegian (NCL)",
    icon: <Ship className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "Free at Sea — Beverage",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Unlimited Open Bar Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 109.00, unit_sell: 109.00, is_pass_through: true }],
      },
      {
        label: "Free at Sea — Wi-Fi (150 min)",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "NCL Wi-Fi 150 min (per person)", source: "manual", quantity: 1, unit_cost: 75.00, unit_sell: 75.00, is_pass_through: true }],
      },
      {
        label: "Free at Sea — Specialty Dining",
        icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Specialty Dining 2-meal package (per person)", source: "manual", quantity: 1, unit_cost: 59.00, unit_sell: 59.00, is_pass_through: true }],
      },
      {
        label: "Gratuities",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "NCL Auto Gratuities ($20/day)", source: "manual", quantity: 1, unit_cost: 20.00, unit_sell: 20.00, is_pass_through: true }],
      },
    ],
  },
  {
    name: "Celebrity Cruises",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "Premium Beverage Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Premium Beverage Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 99.00, unit_sell: 99.00, is_pass_through: true }],
      },
      {
        label: "Classic Beverage Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Classic Beverage Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 69.00, unit_sell: 69.00, is_pass_through: true }],
      },
      {
        label: "Xcelerate Wi-Fi",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Xcelerate Wi-Fi (per device/day)", source: "manual", quantity: 1, unit_cost: 20.00, unit_sell: 20.00, is_pass_through: true }],
      },
      {
        label: "Stream Wi-Fi",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Stream Wi-Fi (per device/day)", source: "manual", quantity: 1, unit_cost: 15.00, unit_sell: 15.00, is_pass_through: true }],
      },
      {
        label: "Gratuities",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Celebrity Auto Gratuities ($19.50/day)", source: "manual", quantity: 1, unit_cost: 19.50, unit_sell: 19.50, is_pass_through: true }],
      },
    ],
  },
  {
    name: "MSC Cruises",
    icon: <Ship className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "Premium Extra Drink Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Premium Extra Drink Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 82.00, unit_sell: 82.00, is_pass_through: true }],
      },
      {
        label: "Easy Drink Package",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Easy Drink Package (per adult/day)", source: "manual", quantity: 1, unit_cost: 52.00, unit_sell: 52.00, is_pass_through: true }],
      },
      {
        label: "Browse Wi-Fi",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "MSC Browse Wi-Fi (per device/day)", source: "manual", quantity: 1, unit_cost: 15.00, unit_sell: 15.00, is_pass_through: true }],
      },
      {
        label: "Stream Wi-Fi",
        icon: <Wifi className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "MSC Stream Wi-Fi (per device/day)", source: "manual", quantity: 1, unit_cost: 22.00, unit_sell: 22.00, is_pass_through: true }],
      },
      {
        label: "Gratuities",
        icon: <DollarSign className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "MSC Auto Gratuities ($16/day)", source: "manual", quantity: 1, unit_cost: 16.00, unit_sell: 16.00, is_pass_through: true }],
      },
    ],
  },
  {
    name: "Virgin Voyages",
    icon: <Ship className="h-3.5 w-3.5" />,
    addons: [
      {
        label: "Bar Tab $300",
        icon: <Wine className="h-3.5 w-3.5" />,
        // Virgin pays 10% commission on bar tabs
        items: [{ line_type: "addon", description: "Virgin Bar Tab $300 (10% commissionable)", source: "manual", quantity: 1, unit_cost: 270.00, unit_sell: 300.00, is_pass_through: false }],
      },
      {
        label: "Bar Tab $500",
        icon: <Wine className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Virgin Bar Tab $500 (10% commissionable)", source: "manual", quantity: 1, unit_cost: 450.00, unit_sell: 500.00, is_pass_through: false }],
      },
      {
        label: "Shore Excursion Credit $200",
        icon: <Anchor className="h-3.5 w-3.5" />,
        // Virgin pays 10% on excursions
        items: [{ line_type: "addon", description: "Shore Excursion Credit $200 (10% commissionable)", source: "manual", quantity: 1, unit_cost: 180.00, unit_sell: 200.00, is_pass_through: false }],
      },
      {
        label: "Shore Excursion Credit $400",
        icon: <Anchor className="h-3.5 w-3.5" />,
        items: [{ line_type: "addon", description: "Shore Excursion Credit $400 (10% commissionable)", source: "manual", quantity: 1, unit_cost: 360.00, unit_sell: 400.00, is_pass_through: false }],
      },
    ],
  },
];

function QuickAddDropdown({ onAddLine }: { onAddLine: (line: Omit<LocalMarginLine, "_preview_total_cost" | "_preview_total_sell" | "_preview_margin">) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed text-muted-foreground hover:text-foreground"
        >
          <Ship className="h-3.5 w-3.5" />
          Cruise Add-ons
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {CRUISE_LINE_ADDONS.map((group, gi) => (
          <DropdownMenuSub key={group.name}>
            <DropdownMenuSubTrigger className="gap-2">
              {group.icon}
              {group.name}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">{group.name} — 2026 Pricing</DropdownMenuLabel>
              {group.addons.map((addon) => (
                <DropdownMenuItem
                  key={addon.label}
                  onClick={() => {
                    addon.items.forEach((item) => {
                      onAddLine({
                        ...item,
                        id: crypto.randomUUID(),
                        sort_order: 0,
                      });
                    });
                  }}
                  className="gap-2"
                >
                  {addon.icon}
                  <span className="flex-1 truncate">{addon.label}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ${addon.items[0].unit_cost.toFixed(2)}
                    {!addon.items[0].is_pass_through && <span className="ml-1 text-primary">★</span>}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  { value: "addon", label: "Add-on" },
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
          </div>

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
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={addLine} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </Button>

            <QuickAddDropdown onAddLine={(line) => onChange([...lines, computePreviewFields({ ...line, sort_order: lines.length })])} />
          </div>
        </div>
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
