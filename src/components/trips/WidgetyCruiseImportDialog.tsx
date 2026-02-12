import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Ship, Search, ChevronRight, Loader2, Anchor, MapPin, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface WidgetySailing {
  holiday_ref: string;
  name: string;
  operator_title: string;
  holiday: string;
}

interface WidgetyDate {
  date_ref: string;
  date_from: string;
  date_to: string;
  ship_title: string;
  starts_at?: { name: string; country: string };
  ends_at?: { name: string; country: string };
  itinerary_code: string;
  availability_string?: string;
}

interface WidgetyItineraryItem {
  day_number: number;
  title: string;
  description: string;
  category: string;
  location: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

interface Props {
  tripId: string;
  departDate: string | null;
  returnDate: string | null;
  destination: string | null;
  cruiseBookings: Array<{
    id: string;
    trip_name: string | null;
    destination: string;
    depart_date: string;
    return_date: string;
    suppliers?: { name: string; supplier_type: string } | null;
  }>;
  onImport: (items: WidgetyItineraryItem[]) => Promise<boolean>;
}

type Step = "search" | "sailings" | "dates" | "preview" | "importing";

export function WidgetyCruiseImportDialog({ tripId, departDate, returnDate, destination, cruiseBookings, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(departDate || "");
  const [dateTo, setDateTo] = useState(returnDate || "");

  // Results
  const [sailings, setSailings] = useState<WidgetySailing[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedHoliday, setSelectedHoliday] = useState<WidgetySailing | null>(null);
  const [dates, setDates] = useState<WidgetyDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<WidgetyDate | null>(null);
  const [previewItems, setPreviewItems] = useState<WidgetyItineraryItem[]>([]);
  const [meta, setMeta] = useState<{ ship_title?: string; operator_title?: string; holiday_name?: string }>({});

  // Auto-match on open
  useEffect(() => {
    if (open && cruiseBookings.length > 0) {
      handleAutoMatch();
    } else if (open) {
      setStep("search");
      setDateFrom(departDate || "");
      setDateTo(returnDate || "");
    }
  }, [open]);

  const callWidgety = async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("widgety-cruise", { body });
    if (error) throw new Error(error.message || "Failed to call Widgety");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleAutoMatch = async () => {
    setLoading(true);
    setStep("sailings");
    try {
      // Use the first cruise booking to search
      const cruise = cruiseBookings[0];
      const supplierName = cruise.suppliers?.name?.toLowerCase().replace(/\s+/g, "-") || "";

      const data = await callWidgety({
        action: "search",
        operators: supplierName || undefined,
        date_from: cruise.depart_date,
        date_to: cruise.return_date,
        market: "us",
        limit: 25,
      });

      setSailings(data.holidays || []);
      setTotalResults(data.total || 0);

      if ((data.holidays || []).length === 0) {
        toast.info("No auto-match found. Try searching manually.");
        setStep("search");
        setSearchQuery(cruise.suppliers?.name || cruise.destination || "");
        setDateFrom(cruise.depart_date);
        setDateTo(cruise.return_date);
      }
    } catch (err) {
      console.error("Auto-match error:", err);
      toast.error("Auto-match failed. Try searching manually.");
      setStep("search");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setStep("sailings");
    try {
      const params: Record<string, any> = {
        action: "search",
        market: "us",
        limit: 25,
      };
      if (searchQuery) params.operators = searchQuery.toLowerCase().replace(/\s+/g, "-");
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await callWidgety(params);
      setSailings(data.holidays || []);
      setTotalResults(data.total || 0);

      if ((data.holidays || []).length === 0) {
        toast.info("No cruises found. Try adjusting your search.");
      }
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Search failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHoliday = async (holiday: WidgetySailing) => {
    setSelectedHoliday(holiday);
    setLoading(true);
    setStep("dates");
    try {
      const data = await callWidgety({
        action: "holiday",
        holiday_ref: holiday.holiday_ref,
        market: "us",
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });

      // Flatten dates from operating_seasons
      const allDates: WidgetyDate[] = [];
      for (const season of data.operating_seasons || []) {
        for (const d of season.dates || []) {
          allDates.push(d);
        }
      }
      setDates(allDates);

      if (allDates.length === 0) {
        toast.info("No sailing dates found for this cruise.");
      }
    } catch (err) {
      console.error("Holiday fetch error:", err);
      toast.error("Failed to load sailing dates");
      setStep("sailings");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDate = async (dateInfo: WidgetyDate) => {
    setSelectedDate(dateInfo);
    setLoading(true);
    setStep("preview");
    try {
      const data = await callWidgety({
        action: "itinerary",
        date_ref: dateInfo.date_ref,
        market: "us",
      });

      setPreviewItems(data.items || []);
      setMeta({
        ship_title: data.ship_title,
        operator_title: data.operator_title,
        holiday_name: data.holiday_name,
      });

      if ((data.items || []).length === 0) {
        toast.info("No itinerary data available for this sailing.");
      }
    } catch (err) {
      console.error("Itinerary fetch error:", err);
      toast.error("Failed to load itinerary");
      setStep("dates");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (previewItems.length === 0) return;
    setStep("importing");
    const success = await onImport(previewItems);
    if (success) {
      toast.success(`Imported ${previewItems.length} cruise itinerary days from Widgety`);
      setOpen(false);
      resetState();
    } else {
      setStep("preview");
    }
  };

  const resetState = () => {
    setStep("search");
    setSailings([]);
    setDates([]);
    setPreviewItems([]);
    setSelectedHoliday(null);
    setSelectedDate(null);
    setMeta({});
    setSearchQuery("");
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), "MMM d, yyyy"); }
    catch { return d; }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Anchor className="h-4 w-4 mr-2" /> Import Cruise Itinerary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            {step === "search" && "Search Widgety Cruises"}
            {step === "sailings" && "Select a Cruise"}
            {step === "dates" && `Sailing Dates — ${selectedHoliday?.name || ""}`}
            {step === "preview" && "Preview Itinerary"}
            {step === "importing" && "Importing..."}
          </DialogTitle>
        </DialogHeader>

        {/* Search Step */}
        {step === "search" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Search for cruise itineraries from Widgety's database of 60+ cruise lines.
            </p>
            <div>
              <Label>Cruise Line / Operator</Label>
              <Input
                placeholder="e.g., royal-caribbean, celebrity-cruises"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Use the operator slug (hyphenated name)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>Date To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between">
              {cruiseBookings.length > 0 && (
                <Button variant="secondary" onClick={handleAutoMatch} disabled={loading}>
                  Auto-Match from Booking
                </Button>
              )}
              <Button onClick={handleSearch} disabled={loading} className="ml-auto">
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </div>
          </div>
        )}

        {/* Sailings List */}
        {step === "sailings" && (
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
                    ← Back to Search
                  </Button>
                  <span className="text-xs text-muted-foreground">{totalResults} results</span>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-3">
                    {sailings.map((s) => (
                      <button
                        key={s.holiday_ref}
                        onClick={() => handleSelectHoliday(s)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.operator_title}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                        </div>
                      </button>
                    ))}
                    {sailings.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No cruises found</p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Date Selection */}
        {step === "dates" && (
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="sm" onClick={() => setStep("sailings")}>
                    ← Back to Cruises
                  </Button>
                  <span className="text-xs text-muted-foreground">{dates.length} departures</span>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-3">
                    {dates.map((d) => (
                      <button
                        key={d.date_ref}
                        onClick={() => handleSelectDate(d)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {formatDate(d.date_from)} — {formatDate(d.date_to)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {d.ship_title && <span>🚢 {d.ship_title}</span>}
                              {d.starts_at && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {d.starts_at.name} → {d.ends_at?.name || ""}
                                </span>
                              )}
                            </div>
                            {d.availability_string && d.availability_string !== "available" && (
                              <Badge variant="secondary" className="mt-1 text-[10px]">
                                {d.availability_string}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                        </div>
                      </button>
                    ))}
                    {dates.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No departures found</p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Preview */}
        {step === "preview" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("dates")}>
                    ← Back to Dates
                  </Button>
                </div>
                {meta.operator_title && (
                  <div className="mb-3 p-2 bg-accent/30 rounded-md">
                    <p className="text-sm font-medium">{meta.holiday_name || selectedHoliday?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.operator_title}{meta.ship_title ? ` • ${meta.ship_title}` : ""}
                    </p>
                  </div>
                )}
                <ScrollArea className="flex-1 h-[300px]">
                  <div className="space-y-1 pr-3">
                    {previewItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 py-1.5">
                        <span className="text-xs font-mono text-muted-foreground w-8 shrink-0 pt-0.5">
                          D{item.day_number}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground/70">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {previewItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No itinerary data available for this sailing
                      </p>
                    )}
                  </div>
                </ScrollArea>
                <Separator className="my-3" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setOpen(false); resetState(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleImport} disabled={previewItems.length === 0}>
                    <Ship className="h-4 w-4 mr-2" /> Import {previewItems.length} Days
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Importing */}
        {step === "importing" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-3" />
            <span className="text-muted-foreground">Importing itinerary...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
