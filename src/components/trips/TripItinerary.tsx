import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Download, Trash2, Import, Clock, MapPin, Plus,
  Plane, Hotel, Ship, Car, UtensilsCrossed, Camera, ShoppingBag,
  Music, Target, Heart,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useItinerary, type ItineraryItem } from "@/hooks/useItinerary";
import { AddItineraryItemDialog } from "./AddItineraryItemDialog";
import { EditItineraryItemDialog } from "./EditItineraryItemDialog";
import { WidgetyCruiseImportDialog } from "./WidgetyCruiseImportDialog";
import { TripBooking } from "@/hooks/useTrips";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import jsPDF from "jspdf";

const categoryIcons: Record<string, any> = {
  flight: Plane, hotel: Hotel, cruise: Ship, transportation: Car,
  dining: UtensilsCrossed, activity: Target, sightseeing: Camera,
  relaxation: Heart, shopping: ShoppingBag, entertainment: Music,
};

const categoryColors: Record<string, string> = {
  flight: "bg-blue-100 text-blue-700 border-blue-200",
  hotel: "bg-amber-100 text-amber-700 border-amber-200",
  cruise: "bg-cyan-100 text-cyan-700 border-cyan-200",
  transportation: "bg-slate-100 text-slate-700 border-slate-200",
  dining: "bg-orange-100 text-orange-700 border-orange-200",
  activity: "bg-green-100 text-green-700 border-green-200",
  sightseeing: "bg-purple-100 text-purple-700 border-purple-200",
  relaxation: "bg-pink-100 text-pink-700 border-pink-200",
  shopping: "bg-rose-100 text-rose-700 border-rose-200",
  entertainment: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

interface Props {
  tripId: string;
  itineraryId?: string | null;
  destination: string | null;
  departDate: string | null;
  returnDate: string | null;
  tripName: string;
  bookings: TripBooking[];
  layout?: "vertical" | "horizontal";
  hideToolbar?: boolean;
  onSidebarReady?: (callbacks: ItinerarySidebarCallbacks) => void;
}

export interface ItinerarySidebarCallbacks {
  generating: boolean;
  hasItems: boolean;
  totalDays: number;
  unimportedBookings: TripBooking[];
  onAIGenerate: (preferences: string) => void;
  onImportBookings: (bookings: TripBooking[]) => void;
  onExportPDF: () => void;
  onClearAll: () => void;
  onAddCategory: (category: string) => void;
  onAddCategoryToDay: (category: string, day: number) => void;
  onWidgetyImport: (items: any[]) => Promise<boolean>;
}

function DayDropZone({ day, onDrop, children, className }: { day: number; onDrop: (category: string, day: number) => void; children: React.ReactNode; className?: string }) {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      className={`${className || ""} ${isOver ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""} transition-all`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-trip-component")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsOver(true);
        }
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        const category = e.dataTransfer.getData("application/x-trip-component");
        if (category) {
          e.preventDefault();
          onDrop(category, day);
        }
        setIsOver(false);
      }}
    >
      {children}
    </div>
  );
}

export function TripItinerary({ tripId, itineraryId, destination, departDate, returnDate, tripName, bookings, layout = "vertical", hideToolbar, onSidebarReady }: Props) {
  const { items, loading, generating, addItem, updateItem, deleteItem, generateWithAI, clearAll, importFromBookings, fetchItems } = useItinerary(tripId, itineraryId);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [preferences, setPreferences] = useState("");
  const [addCategoryDay, setAddCategoryDay] = useState<{ day: number; category: string } | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  const handleDropComponent = useCallback((category: string, day: number) => {
    setAddCategoryDay({ day, category });
  }, []);

  // Detect cruise bookings for Widgety integration
  const cruiseBookings = bookings.filter(
    (b) => b.suppliers?.supplier_type?.toLowerCase() === "cruise"
  );

  const handleWidgetyImport = async (widgetyItems: any[]) => {
    if (!widgetyItems.length) return false;
    try {
      // Use batch addItem — the hook handles user_id
      for (const item of widgetyItems) {
        const success = await addItem({
          trip_id: tripId,
          day_number: item.day_number || 1,
          title: item.title,
          description: item.description || undefined,
          category: item.category || "cruise",
          location: item.location || undefined,
          start_time: item.start_time || undefined,
          end_time: item.end_time || undefined,
          notes: item.notes || undefined,
          sort_order: widgetyItems.indexOf(item),
        });
        if (!success) return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const totalDays = departDate && returnDate
    ? differenceInDays(parseISO(returnDate), parseISO(departDate)) + 1
    : Math.max(...items.map(i => i.day_number), 1);

  const dayGroups: Record<number, ItineraryItem[]> = {};
  for (const item of items) {
    if (!dayGroups[item.day_number]) dayGroups[item.day_number] = [];
    dayGroups[item.day_number].push(item);
  }

  const handleGenerate = async () => {
    setAiPromptOpen(false);
    await generateWithAI(destination, departDate, returnDate, tripName, bookings, preferences);
    setPreferences("");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.text(tripName, 14, y); y += 8;
    doc.setFontSize(11);
    if (destination) { doc.text(`Destination: ${destination}`, 14, y); y += 6; }
    if (departDate && returnDate) {
      doc.text(`${format(parseISO(departDate), "MMM d, yyyy")} — ${format(parseISO(returnDate), "MMM d, yyyy")}`, 14, y);
      y += 10;
    }

    for (let day = 1; day <= totalDays; day++) {
      if (y > 260) { doc.addPage(); y = 20; }
      const dateStr = departDate ? format(addDays(parseISO(departDate), day - 1), "EEEE, MMM d") : "";
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Day ${day}${dateStr ? ` — ${dateStr}` : ""}`, 14, y); y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const dayItems = dayGroups[day] || [];
      if (dayItems.length === 0) {
        doc.text("No activities planned", 20, y); y += 6;
      } else {
        for (const item of dayItems) {
          if (y > 270) { doc.addPage(); y = 20; }
          const time = item.start_time ? item.start_time.slice(0, 5) : "";
          doc.text(`${time ? time + "  " : ""}${item.title}`, 20, y); y += 5;
          if (item.description) {
            doc.setTextColor(100);
            const lines = doc.splitTextToSize(item.description, 160);
            doc.text(lines, 24, y); y += lines.length * 4.5;
            doc.setTextColor(0);
          }
          if (item.location) {
            doc.setTextColor(120);
            doc.text(`📍 ${item.location}`, 24, y); y += 5;
            doc.setTextColor(0);
          }
          y += 2;
        }
      }
      y += 4;
    }

    doc.save(`${tripName.replace(/\s+/g, "_")}_Itinerary.pdf`);
  };

  // Bookings not yet imported
  const importedBookingIds = new Set(items.filter(i => i.booking_id).map(i => i.booking_id));
  const unimportedBookings = bookings.filter(b => !importedBookingIds.has(b.id));

  // Expose callbacks for sidebar
  useEffect(() => {
    if (onSidebarReady) {
      onSidebarReady({
        generating,
        hasItems: items.length > 0,
        totalDays,
        unimportedBookings,
        onAIGenerate: async (prefs: string) => {
          await generateWithAI(destination, departDate, returnDate, tripName, bookings, prefs);
        },
        onImportBookings: importFromBookings,
        onExportPDF: handleExportPDF,
        onClearAll: clearAll,
        onAddCategory: (category: string) => {
          setAddCategoryDay({ day: 1, category });
        },
        onAddCategoryToDay: (category: string, day: number) => {
          setAddCategoryDay({ day, category });
        },
        onWidgetyImport: handleWidgetyImport,
      });
    }
  }, [onSidebarReady, generating, items.length, unimportedBookings.length, totalDays]);

  if (loading) {
    return <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar — hidden when sidebar controls are used */}
      {!hideToolbar && <div className="flex flex-wrap items-center gap-2">
        <Dialog open={aiPromptOpen} onOpenChange={setAiPromptOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" />
              {generating ? "Generating..." : "AI Generate"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> AI Itinerary Builder
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                AI will create a detailed day-by-day itinerary based on your trip details
                {destination ? ` to ${destination}` : ""}.
                {items.length > 0 && " Existing items will be kept."}
              </p>
              <div>
                <Textarea
                  placeholder="Optional: Add preferences like 'focus on local cuisine', 'family-friendly activities', 'luxury experiences', etc."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAiPromptOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  <Sparkles className="h-4 w-4 mr-2" /> Generate Itinerary
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {unimportedBookings.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => importFromBookings(unimportedBookings)}>
            <Import className="h-4 w-4 mr-2" /> Import Bookings ({unimportedBookings.length})
          </Button>
        )}

        {/* Cruise Library Import — show when there are cruise bookings or cruise-related trip/destination */}
        {(cruiseBookings.length > 0 || destination?.toLowerCase().includes("cruise") || tripName?.toLowerCase().includes("cruise")) && (
          <WidgetyCruiseImportDialog
            tripId={tripId}
            departDate={departDate}
            returnDate={returnDate}
            destination={destination}
            cruiseBookings={cruiseBookings}
            onImport={handleWidgetyImport}
          />
        )}

        {items.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Clear All
                </Button>
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
                  <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>}

      {/* Empty State — also a drop zone */}
      {items.length === 0 && !generating && (
        <DayDropZone day={1} onDrop={handleDropComponent}>
          <Card className="border-dashed border-2 transition-colors">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Itinerary Yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Drag a trip component here, use AI to auto-generate, import from existing bookings, or add items manually.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setAiPromptOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
                </Button>
                {unimportedBookings.length > 0 && (
                  <Button variant="outline" onClick={() => importFromBookings(unimportedBookings)}>
                    <Import className="h-4 w-4 mr-2" /> Import Bookings
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </DayDropZone>
      )}

      {/* Generating skeleton */}
      {generating && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">AI is building your itinerary...</p>
          </CardContent>
        </Card>
      )}

      {/* Day-by-day timeline */}
      {items.length > 0 && layout === "horizontal" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${totalDays * 320}px` }}>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const dayItems = dayGroups[day] || [];
              const dateStr = departDate ? format(addDays(parseISO(departDate), day - 1), "EEE, MMM d") : null;

              return (
                <DayDropZone
                  key={day}
                  day={day}
                  onDrop={handleDropComponent}
                  className="min-w-[300px] max-w-[340px] flex-shrink-0"
                >
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                            {day}
                          </span>
                          Day {day}
                        </CardTitle>
                        <AddItineraryItemDialog tripId={tripId} dayNumber={day} onAdd={addItem} />
                      </div>
                      {dateStr && <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>}
                    </CardHeader>
                    <CardContent>
                      {dayItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No activities planned</p>
                      ) : (
                        <div className="space-y-2">
                          {dayItems.map((item) => {
                            const Icon = categoryIcons[item.category] || Target;
                            return (
                              <div key={item.id} className="flex gap-2 group relative p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setEditingItem(item)}>
                                <div className={`h-7 w-7 rounded-md flex-shrink-0 flex items-center justify-center ${categoryColors[item.category] || categoryColors.activity}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="font-medium text-sm truncate">{item.title}</span>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive flex-shrink-0"
                                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                    {item.start_time && (
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="h-2.5 w-2.5" />
                                        {item.start_time.slice(0, 5)}
                                      </span>
                                    )}
                                    {item.location && (
                                      <span className="flex items-center gap-0.5 truncate">
                                        <MapPin className="h-2.5 w-2.5" /> {item.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </DayDropZone>
              );
            })}
          </div>
        </div>
      ) : items.length > 0 && Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
        const dayItems = dayGroups[day] || [];
        const dateStr = departDate ? format(addDays(parseISO(departDate), day - 1), "EEEE, MMM d") : null;

        return (
          <DayDropZone key={day} day={day} onDrop={handleDropComponent}>
            <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {day}
                  </span>
                  Day {day}
                  {dateStr && <span className="text-muted-foreground font-normal text-sm">— {dateStr}</span>}
                </CardTitle>
                <AddItineraryItemDialog tripId={tripId} dayNumber={day} onAdd={addItem} />
              </div>
            </CardHeader>
            <CardContent>
              {dayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No activities planned</p>
              ) : (
                <div className="space-y-3">
                  {dayItems.map((item) => {
                    const Icon = categoryIcons[item.category] || Target;
                    return (
                      <div key={item.id} className="flex gap-3 group relative cursor-pointer" onClick={() => setEditingItem(item)}>
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${categoryColors[item.category] || categoryColors.activity}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {dayItems.indexOf(item) < dayItems.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{item.title}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryColors[item.category] || ""}`}>
                                  {item.category}
                                </Badge>
                                {item.booking_id && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Booking</Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {item.start_time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.start_time.slice(0, 5)}
                                    {item.end_time && ` – ${item.end_time.slice(0, 5)}`}
                                  </span>
                                )}
                                {item.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {item.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </DayDropZone>
        );
      })}

      {/* Add new day */}
      {items.length > 0 && (
        <AddItineraryItemDialog tripId={tripId} dayNumber={totalDays + 1} onAdd={addItem} />
      )}

      {/* Controlled dialog for sidebar click / drag-drop */}
      {addCategoryDay && (
        <AddItineraryItemDialog
          tripId={tripId}
          dayNumber={addCategoryDay.day}
          defaultCategory={addCategoryDay.category}
          onAdd={addItem}
          controlledOpen={!!addCategoryDay}
          onControlledOpenChange={(open) => {
            if (!open) setAddCategoryDay(null);
          }}
        />
      )}

      {/* Edit dialog */}
      {editingItem && (
        <EditItineraryItemDialog
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => { if (!open) setEditingItem(null); }}
          onUpdate={updateItem}
        />
      )}
    </div>
  );
}
