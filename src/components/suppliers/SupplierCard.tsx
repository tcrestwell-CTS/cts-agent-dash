import { Star, ExternalLink, StickyNote, Clock, Plus, Zap, Link2 } from "lucide-react";
import { Panel } from "@/components/patterns/Panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Supplier } from "@/types/supplier";
import { formatDistanceToNow } from "date-fns";

interface SupplierCardProps {
  supplier: Supplier;
  onToggleFavorite: (id: string) => void;
  onOpenSite: (supplier: Supplier) => void;
  onOpenNotes: (supplier: Supplier) => void;
  onQuickBook?: (supplier: Supplier) => void;
  compact?: boolean;
}

const integrationTypeLabels: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  api: { label: "API", color: "bg-success/10 text-success border-success/20", icon: Zap },
  redirect: { label: "Portal", color: "bg-accent/10 text-accent border-accent/20", icon: Link2 },
  hybrid: { label: "Hybrid", color: "bg-info/10 text-info border-info/20", icon: Zap },
};

const categoryColors: Record<string, string> = {
  flights: "bg-primary/10 text-primary border-primary/20",
  cruises: "bg-accent/50 text-accent-foreground border-accent",
  hotels: "bg-secondary text-secondary-foreground border-secondary",
  transportation: "bg-muted text-muted-foreground border-border",
  "all-inclusive": "bg-primary/5 text-primary border-primary/10",
};

export function SupplierCard({
  supplier,
  onToggleFavorite,
  onOpenSite,
  onOpenNotes,
  onQuickBook,
  compact = false
}: SupplierCardProps) {
  const integrationType = integrationTypeLabels[supplier.integrationType || "redirect"];
  if (compact) {
    return (
      <Panel
        className="group cursor-pointer transition-shadow hover:shadow-md hover:border-primary/50"
        onClick={() => onOpenSite(supplier)}
      >
        <div className="flex items-center justify-between gap-3 p-[14px]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-muted">
              <span className="text-[15px] font-bold text-primary">
                {supplier.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-foreground">{supplier.name}</p>
              <p className="text-[11.5px] text-muted-foreground">
                {supplier.visitCount} visits
              </p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </Panel>
    );
  }

  const IntegrationIcon = integrationType.icon;

  return (
    <Panel className="group transition-shadow hover:shadow-lg hover:border-primary/50">
      <div className="flex items-start justify-between gap-2 p-[14px] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[9px] bg-muted">
            <span className="text-lg font-bold text-primary">
              {supplier.name.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[14.5px] font-semibold text-foreground">{supplier.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("text-[11.5px] capitalize", categoryColors[supplier.category])}
              >
                {supplier.category}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[11.5px]", integrationType.color)}
              >
                <IntegrationIcon className="h-3 w-3 mr-1" />
                {integrationType.label}
              </Badge>
              {supplier.apiStatus === "coming_soon" && (
                <Badge variant="outline" className="text-[11.5px] bg-warning/10 text-warning border-warning/20">
                  API Soon
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(supplier.id);
              }}
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  supplier.isFavorite
                    ? "fill-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {supplier.isFavorite ? "Remove from favorites" : "Add to favorites"}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="space-y-3 p-[14px] pt-0">
        <p className="line-clamp-2 text-[13px] text-muted-foreground">
          {supplier.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[12.5px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{supplier.visitCount} visits</span>
          </div>
          {supplier.lastVisited && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDistanceToNow(supplier.lastVisited, { addSuffix: true })}</span>
            </div>
          )}
          {supplier.notes && (
            <div className="flex items-center gap-1">
              <StickyNote className="h-3.5 w-3.5" />
              <span>Has notes</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-[8px] text-[13px]"
            onClick={() => onOpenSite(supplier)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Portal
          </Button>
          {onQuickBook && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-[8px]"
                  onClick={() => onQuickBook(supplier)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import Booking</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-[8px]"
                onClick={() => onOpenNotes(supplier)}
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add/Edit Notes</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Panel>
  );
}
