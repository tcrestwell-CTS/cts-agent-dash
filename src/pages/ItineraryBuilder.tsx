import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Rows3, Columns3, PanelLeft, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { TripItinerary, type ItinerarySidebarCallbacks } from "@/components/trips/TripItinerary";
import { ItinerarySidebar } from "@/components/trips/ItinerarySidebar";
import { useTrip } from "@/hooks/useTrips";
import { useItineraries } from "@/hooks/useItineraries";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ItineraryBuilder = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trip, bookings, loading } = useTrip(tripId);
  const { itineraries, activeId, setActiveId, createItinerary, renameItinerary, deleteItinerary } = useItineraries(tripId);
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCallbacks, setSidebarCallbacks] = useState<ItinerarySidebarCallbacks | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSidebarReady = useCallback((callbacks: ItinerarySidebarCallbacks) => {
    setSidebarCallbacks(callbacks);
  }, []);

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = async () => {
    if (renamingId && renameValue.trim()) {
      await renameItinerary(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteItinerary(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!trip) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive font-medium">Trip not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/trips")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Trips
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{trip.trip_name}</h1>
              <p className="text-muted-foreground text-sm">
                Itinerary Builder
                {trip.destination && ` · ${trip.destination}`}
              </p>
            </div>
          </div>

          <TooltipProvider>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted p-1 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={layout === "vertical" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setLayout("vertical")}
                    >
                      <Rows3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vertical layout</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={layout === "horizontal" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setLayout("horizontal")}
                    >
                      <Columns3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Horizontal layout</TooltipContent>
                </Tooltip>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Itinerary Tabs */}
        <div className="flex items-center gap-1 border-b">
          {itineraries.map((itin) => (
            <div key={itin.id} className="flex items-center group">
              {renamingId === itin.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}
                  className="flex items-center px-1 pb-2"
                >
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-7 w-40 text-sm"
                    autoFocus
                    onBlur={handleRenameSubmit}
                  />
                </form>
              ) : (
                <button
                  onClick={() => setActiveId(itin.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeId === itin.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  {itin.name}
                </button>
              )}
              {/* Tab menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuItem onClick={() => handleRenameStart(itin.id, itin.name)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  {itineraries.length > 1 && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteConfirmId(itin.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <button
            onClick={() => createItinerary()}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Content with sidebar */}
        <div className="flex gap-0 rounded-lg border bg-background overflow-hidden" style={{ minHeight: "calc(100vh - 280px)" }}>
          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeId && (
              <TripItinerary
                tripId={tripId!}
                itineraryId={activeId}
                destination={trip.destination}
                departDate={trip.depart_date}
                returnDate={trip.return_date}
                tripName={trip.trip_name}
                bookings={bookings}
                layout={layout}
                hideToolbar={sidebarOpen}
                onSidebarReady={handleSidebarReady}
              />
            )}
          </div>

          {/* Sidebar — right side */}
          {sidebarOpen && sidebarCallbacks && (
            <ItinerarySidebar
              tripId={tripId!}
              destination={trip.destination}
              departDate={trip.depart_date}
              returnDate={trip.return_date}
              tripName={trip.trip_name}
              bookings={bookings}
              generating={sidebarCallbacks.generating}
              hasItems={sidebarCallbacks.hasItems}
              unimportedBookings={sidebarCallbacks.unimportedBookings}
              onAIGenerate={sidebarCallbacks.onAIGenerate}
              onImportBookings={sidebarCallbacks.onImportBookings}
              onExportPDF={sidebarCallbacks.onExportPDF}
              onClearAll={sidebarCallbacks.onClearAll}
              onAddCategory={sidebarCallbacks.onAddCategory}
              onWidgetyImport={sidebarCallbacks.onWidgetyImport}
            />
          )}
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Itinerary?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this itinerary and all its items. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ItineraryBuilder;
