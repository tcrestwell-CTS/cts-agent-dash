import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Download, Trash2, Import, Ship,
  Plane, Hotel, Car, UtensilsCrossed, Camera, ShoppingBag,
  Music, Target, Heart, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WidgetyCruiseImportDialog } from "./WidgetyCruiseImportDialog";
import { TripBooking } from "@/hooks/useTrips";

interface ItinerarySidebarProps {
  tripId: string;
  destination: string | null;
  departDate: string | null;
  returnDate: string | null;
  tripName: string;
  bookings: TripBooking[];
  generating: boolean;
  hasItems: boolean;
  unimportedBookings: TripBooking[];
  onAIGenerate: (preferences: string) => void;
  onImportBookings: (bookings: TripBooking[]) => void;
  onExportPDF: () => void;
  onClearAll: () => void;
  onAddCategory: (category: string) => void;
  onWidgetyImport: (items: any[]) => Promise<boolean>;
}

const tripComponents = [
  { category: "flight", label: "Flight", icon: Plane },
  { category: "hotel", label: "Lodging", icon: Hotel },
  { category: "transportation", label: "Transportation", icon: Car },
  { category: "cruise", label: "Cruise", icon: Ship },
  { category: "dining", label: "Dining", icon: UtensilsCrossed },
  { category: "activity", label: "Activity", icon: Target },
  { category: "sightseeing", label: "Sightseeing", icon: Camera },
  { category: "relaxation", label: "Relaxation", icon: Heart },
  { category: "shopping", label: "Shopping", icon: ShoppingBag },
  { category: "entertainment", label: "Entertainment", icon: Music },
];

export function ItinerarySidebar({
  tripId,
  destination,
  departDate,
  returnDate,
  tripName,
  bookings,
  generating,
  hasItems,
  unimportedBookings,
  onAIGenerate,
  onImportBookings,
  onExportPDF,
  onClearAll,
  onAddCategory,
  onWidgetyImport,
}: ItinerarySidebarProps) {
  const [aiOpen, setAiOpen] = useState(true);
  const [preferences, setPreferences] = useState("");

  const cruiseBookings = bookings.filter(
    (b) => b.suppliers?.supplier_type?.toLowerCase() === "cruise"
  );
  const showCruise = cruiseBookings.length > 0 || destination?.toLowerCase().includes("cruise") || tripName?.toLowerCase().includes("cruise");

  const handleGenerate = () => {
    onAIGenerate(preferences);
    setPreferences("");
  };

  return (
    <div className="w-[240px] flex-shrink-0 border-r bg-card overflow-y-auto h-full">
      <div className="p-4 space-y-5">
        {/* Title */}
        <h3 className="font-semibold text-sm">Build your trip</h3>

        {/* AI Assist Section */}
        <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium">AI Assist</span>
              </div>
              {aiOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <Textarea
              placeholder="Add preferences like 'local cuisine', 'family-friendly'..."
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {generating ? "Generating..." : "Generate"}
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Library Items */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Library Items</p>

          {unimportedBookings.length > 0 && (
            <button
              onClick={() => onImportBookings(unimportedBookings)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-foreground"
            >
              <Import className="h-4 w-4 text-primary" />
              <span>Import Bookings</span>
              <span className="ml-auto text-[10px] bg-primary/10 text-primary font-medium rounded-full px-1.5 py-0.5">{unimportedBookings.length}</span>
            </button>
          )}

          {showCruise && (
            <WidgetyCruiseImportDialog
              tripId={tripId}
              departDate={departDate}
              returnDate={returnDate}
              destination={destination}
              cruiseBookings={cruiseBookings}
              onImport={onWidgetyImport}
            />
          )}
        </div>

        <Separator />

        {/* Trip Components */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Trip Components</p>
          {tripComponents.map(({ category, label, icon: Icon }) => (
            <button
              key={category}
              onClick={() => onAddCategory(category)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-foreground"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {hasItems && (
          <>
            <Separator />

            {/* Actions */}
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Actions</p>
              <button
                onClick={onExportPDF}
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-foreground"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                <span>Export PDF</span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span>Clear All</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Itinerary?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all itinerary items. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
