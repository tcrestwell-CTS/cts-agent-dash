import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Panel } from "@/components/patterns/Panel";
import { StatusPill } from "@/components/patterns/StatusPill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, MapPin, Loader2, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Trip } from "@/hooks/useTrips";
import type { CancellationOptions } from "@/components/trips/TripStatusWorkflow";

type KanbanTrip = Trip & { kanbanStatus?: string };

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function DaysOutBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0)
    return (
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
        {Math.abs(days)}d ago
      </span>
    );
  const tone =
    days < 7
      ? "bg-destructive/15 text-destructive"
      : days < 14
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${tone}`}>in {days}d</span>
  );
}

export interface KanbanColumn {
  id: string;
  label: string;
  color: string;
}

interface TripsKanbanProps {
  trips: KanbanTrip[];
  columns: KanbanColumn[];
  onStatusChange: (tripId: string, newStatus: string, cancellationOptions?: CancellationOptions) => Promise<boolean>;
}

// Convert hex color to a Tailwind-compatible border style
function columnBorderStyle(hexColor: string) {
  return { borderTopColor: hexColor };
}

export function TripsKanban({ trips, columns, onStatusChange }: TripsKanbanProps) {
  const navigate = useNavigate();
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [pendingDrag, setPendingDrag] = useState<{ tripId: string; newStatus: "cancelled" | "archived"; tripName: string } | null>(null);
  const [cleanupOptions, setCleanupOptions] = useState<CancellationOptions>({
    unpublish: true,
    deactivateAutomations: true,
    completeTasks: true,
  });

  const tripsByStatus = columns.reduce((acc, col) => {
    acc[col.id] = trips.filter((t) => (t.kanbanStatus || t.status) === col.id);
    return acc;
  }, {} as Record<string, KanbanTrip[]>);

  // Also collect trips with statuses not in any column (orphaned) — place in lead
  const knownIds = new Set(columns.map((c) => c.id));
  const orphanedTrips = trips.filter((t) => !knownIds.has(t.kanbanStatus || t.status));
  if (orphanedTrips.length > 0 && tripsByStatus["lead"]) {
    tripsByStatus["lead"] = [...tripsByStatus["lead"], ...orphanedTrips];
  }

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    const trip = trips.find((t) => t.id === draggableId);
    if (!trip || trip.status === newStatus) return;

    // Intercept cancelled/archived to show cleanup dialog
    if (newStatus === "cancelled" || newStatus === "archived") {
      setPendingDrag({ tripId: trip.id, newStatus, tripName: trip.trip_name });
      setCleanupOptions({ unpublish: true, deactivateAutomations: true, completeTasks: true });
      setShowCleanupDialog(true);
      return;
    }

    await onStatusChange(draggableId, newStatus);
  };

  const handleCleanupSubmit = async () => {
    if (!pendingDrag) return;
    setShowCleanupDialog(false);
    await onStatusChange(pendingDrag.tripId, pendingDrag.newStatus, cleanupOptions);
    setPendingDrag(null);
  };

  const handleCleanupCancel = () => {
    setShowCleanupDialog(false);
    setPendingDrag(null);
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3.5 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
          {columns.map((col) => (
            <Droppable droppableId={col.id} key={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={columnBorderStyle(col.color)}
                  className={`flex-shrink-0 w-[320px] flex flex-col rounded-[11px] border-t-4 ${
                    snapshot.isDraggingOver ? "bg-accent/40" : "bg-card-2"
                  } transition-colors`}
                >
                  <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-semibold text-foreground truncate">{col.label}</h3>
                    <StatusPill color={col.color} label={String(tripsByStatus[col.id]?.length || 0)} />
                  </div>
                  <div className="flex-1 px-2.5 pb-2.5 space-y-2.5 overflow-y-auto">
                    {tripsByStatus[col.id]?.map((trip, index) => (
                      <Draggable
                        key={trip.id}
                        draggableId={trip.id}
                        index={index}
                        isDragDisabled={trip.isOptimistic}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => !trip.isOptimistic && navigate(`/trips/${trip.id}`)}
                            className={`cursor-pointer ${snapshot.isDragging ? "rotate-2 shadow-lg" : ""}`}
                          >
                            <KanbanTripCard trip={trip} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}


        </div>
      </DragDropContext>

      {/* Cleanup Dialog for Cancel / Archive from Kanban */}
      <Dialog open={showCleanupDialog} onOpenChange={(open) => { if (!open) handleCleanupCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Move {pendingDrag?.tripName ? `"${pendingDrag.tripName}"` : "trip"} to{" "}
              {pendingDrag?.newStatus === "cancelled" ? "Cancelled" : "Archived"}
            </DialogTitle>
            <DialogDescription>
              Choose what happens with this trip's automations, tasks, and publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={cleanupOptions.unpublish}
                onCheckedChange={(checked) =>
                  setCleanupOptions((prev) => ({ ...prev, unpublish: checked === true }))
                }
              />
              <span className="text-sm font-medium">Unpublish Trip</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={cleanupOptions.deactivateAutomations}
                onCheckedChange={(checked) =>
                  setCleanupOptions((prev) => ({ ...prev, deactivateAutomations: checked === true }))
                }
              />
              <span className="text-sm font-medium">Deactivate Automations</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={cleanupOptions.completeTasks}
                onCheckedChange={(checked) =>
                  setCleanupOptions((prev) => ({ ...prev, completeTasks: checked === true }))
                }
              />
              <span className="text-sm font-medium">Complete Tasks</span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCleanupCancel}>
              Cancel
            </Button>
            <Button onClick={handleCleanupSubmit}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KanbanTripCard({ trip }: { trip: Trip }) {
  const days = daysUntil(trip.depart_date);
  const guests = (trip as any).num_travelers ?? (trip as any).travelers ?? null;
  return (
    <Panel className={`overflow-hidden transition-shadow hover:shadow-lg ${trip.isOptimistic ? "opacity-60 animate-pulse" : ""}`}>
      {trip.cover_image_url && (
        <div className="h-28 w-full overflow-hidden">
          <img
            src={trip.cover_image_url}
            alt={trip.trip_name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3.5 space-y-2">
        <h4 className="text-[14.5px] font-semibold leading-snug line-clamp-2 text-foreground">
          {trip.isOptimistic && <Loader2 className="inline h-4 w-4 animate-spin mr-1" />}
          {trip.trip_name}
        </h4>
        {trip.clients?.name && (
          <p className="text-[12.5px] text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{trip.clients.name}</span>
          </p>
        )}
        {trip.destination && (
          <p className="text-[12.5px] text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{trip.destination}</span>
          </p>
        )}
        {trip.depart_date && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{format(parseLocalDate(trip.depart_date), "MMM d, yyyy")}</span>
            <DaysOutBadge days={days} />
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          {guests ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground [font-variant-numeric:tabular-nums]">
              <Users className="h-3.5 w-3.5" />
              {guests}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground [font-variant-numeric:tabular-nums]">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            {formatMoney(trip.total_gross_sales)}
          </span>
        </div>
      </div>
    </Panel>
  );
}
