/**
 * ItineraryStylePicker
 *
 * A per-itinerary settings panel that lets advisors toggle:
 *   - 4 header display styles (how the cover image is shown)
 *   - 3 font options (typeface used across the proposal)
 *
 * Saves directly to the itineraries table via updateItinerary.
 * Rendered inside ItinerarySidebar / TripDetail itinerary settings area.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Palette, Type, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeaderStyle = "full_bleed" | "large" | "minimized" | "legacy";
export type FontStyle   = "standard"  | "sans"   | "serif";

// ── Config ────────────────────────────────────────────────────────────────────

const HEADER_STYLES: {
  value: HeaderStyle;
  label: string;
  description: string;
  preview: React.ReactNode;
}[] = [
  {
    value: "full_bleed",
    label: "Full Bleed",
    description: "Full-viewport cinematic image, title overlaid",
    preview: (
      <div className="w-full h-14 rounded overflow-hidden relative bg-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-600 to-slate-800 opacity-70" />
        <div className="absolute inset-0 flex flex-col justify-end p-2">
          <div className="h-2 w-16 bg-white/90 rounded-sm mb-1" />
          <div className="h-1.5 w-10 bg-white/60 rounded-sm" />
        </div>
        <div className="absolute top-1 right-1">
          <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/40 text-white/80 bg-transparent">
            Full
          </Badge>
        </div>
      </div>
    ),
  },
  {
    value: "large",
    label: "Large Image",
    description: "Prominent image above title — balanced look",
    preview: (
      <div className="w-full h-14 rounded overflow-hidden bg-white border">
        <div className="h-8 w-full bg-gradient-to-r from-slate-300 to-slate-400" />
        <div className="px-2 pt-1 space-y-1">
          <div className="h-1.5 w-14 bg-slate-700 rounded-sm" />
          <div className="h-1 w-10 bg-slate-400 rounded-sm" />
        </div>
      </div>
    ),
  },
  {
    value: "minimized",
    label: "Minimized",
    description: "Compact banner — gets clients to content faster",
    preview: (
      <div className="w-full h-14 rounded overflow-hidden bg-white border">
        <div className="h-4 w-full bg-gradient-to-r from-slate-300 to-slate-400 relative">
          <div className="absolute bottom-0.5 left-2">
            <div className="h-1 w-12 bg-white/80 rounded-sm" />
          </div>
        </div>
        <div className="px-2 pt-1.5 space-y-1">
          <div className="h-1.5 w-14 bg-slate-700 rounded-sm" />
          <div className="h-1 w-10 bg-slate-400 rounded-sm" />
          <div className="h-1 w-8 bg-slate-300 rounded-sm" />
        </div>
      </div>
    ),
  },
  {
    value: "legacy",
    label: "Classic",
    description: "Text-only — clean and fast, no image header",
    preview: (
      <div className="w-full h-14 rounded overflow-hidden bg-white border flex flex-col justify-center px-3 space-y-1.5">
        <div className="h-2 w-16 bg-slate-700 rounded-sm" />
        <div className="h-1.5 w-12 bg-slate-400 rounded-sm" />
        <div className="h-1 w-20 bg-slate-300 rounded-sm" />
      </div>
    ),
  },
];

const FONT_STYLES: {
  value: FontStyle;
  label: string;
  description: string;
  sampleFont: string;
  sampleClass: string;
  googleFont?: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Clean system sans-serif",
    sampleFont: "system-ui, sans-serif",
    sampleClass: "font-sans",
  },
  {
    value: "sans",
    label: "Modern",
    description: "Outfit — contemporary & approachable",
    sampleFont: "'Outfit', sans-serif",
    sampleClass: "",
    googleFont: "Outfit:wght@400;600;700",
  },
  {
    value: "serif",
    label: "Luxury",
    description: "Cormorant Garamond — refined & editorial",
    sampleFont: "'Cormorant Garamond', serif",
    sampleClass: "",
    googleFont: "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  itineraryId: string;
  currentHeaderStyle: HeaderStyle | null;
  currentFontStyle: FontStyle | null;
  onUpdate: (id: string, updates: { header_style?: string; font_style?: string }) => Promise<any>;
  hasCoverImage: boolean;
}

export function ItineraryStylePicker({
  itineraryId,
  currentHeaderStyle,
  currentFontStyle,
  onUpdate,
  hasCoverImage,
}: Props) {
  const headerStyle: HeaderStyle = currentHeaderStyle || "full_bleed";
  const fontStyle: FontStyle     = currentFontStyle   || "standard";
  const [saving, setSaving] = useState<"header" | "font" | null>(null);

  const handleHeaderChange = async (style: HeaderStyle) => {
    if (style === headerStyle) return;
    setSaving("header");
    try {
      await onUpdate(itineraryId, { header_style: style });
      toast.success(`Header style set to "${HEADER_STYLES.find(s => s.value === style)?.label}"`);
    } finally {
      setSaving(null);
    }
  };

  const handleFontChange = async (style: FontStyle) => {
    if (style === fontStyle) return;
    setSaving("font");
    try {
      await onUpdate(itineraryId, { font_style: style });
      toast.success(`Font set to "${FONT_STYLES.find(s => s.value === style)?.label}"`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header Display Style ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Header Style</span>
          {saving === "header" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {!hasCoverImage && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md px-2.5 py-1.5 mb-3">
            Add a cover image to the itinerary to preview image-based header styles.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {HEADER_STYLES.map((style) => {
            const isActive = headerStyle === style.value;
            const imageRequired = style.value !== "legacy" && !hasCoverImage;
            return (
              <button
                key={style.value}
                type="button"
                disabled={saving !== null}
                onClick={() => handleHeaderChange(style.value)}
                data-testid={`header-style-${style.value}`}
                className={cn(
                  "relative rounded-lg border-2 p-1 text-left transition-all group",
                  "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary ring-1 ring-primary/20"
                    : "border-border",
                  imageRequired && "opacity-50"
                )}
                title={imageRequired ? "Requires a cover image" : style.description}
              >
                {style.preview}
                <div className="mt-1.5 px-0.5">
                  <p className={cn(
                    "text-xs font-semibold leading-tight",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {style.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 hidden group-hover:block">
                    {style.description}
                  </p>
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Font Style ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Type className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Proposal Font</span>
          {saving === "font" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        <div className="space-y-2">
          {FONT_STYLES.map((style) => {
            const isActive = fontStyle === style.value;
            return (
              <button
                key={style.value}
                type="button"
                disabled={saving !== null}
                onClick={() => handleFontChange(style.value)}
                data-testid={`font-style-${style.value}`}
                className={cn(
                  "w-full rounded-lg border-2 px-3 py-2.5 text-left transition-all flex items-center gap-3",
                  "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                {/* Font sample */}
                <div
                  className="text-xl font-semibold leading-none flex-shrink-0 w-10 text-center"
                  style={{ fontFamily: style.sampleFont }}
                >
                  Aa
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {style.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                </div>
                {isActive && (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Export constants for use in SharedTrip ────────────────────────────────────

export { HEADER_STYLES, FONT_STYLES };
export type { HeaderStyle as ItineraryHeaderStyle, FontStyle as ItineraryFontStyle };
