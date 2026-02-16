import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Trip } from "@/hooks/useTrips";

const KANBAN_COLUMNS = [
  { id: "inbound", label: "Inbound", color: "border-t-amber-400" },
  { id: "planning", label: "Planning", color: "border-t-blue-400" },
  { id: "booked", label: "Booked", color: "border-t-green-400" },
  { id: "traveling", label: "Traveling", color: "border-t-purple-400" },
  { id: "completed", label: "Traveled", color: "border-t-gray-400" },
  { id: "cancelled", label: "Cancelled", color: "border-t-red-400" },
  { id: "archived", label: "Archived", color: "border-t-slate-400" },
];

interface TripsKanbanProps {
  trips: Trip[];
  onStatusChange: (tripId: string, newStatus: string) => Promise<boolean>;
}

export function TripsKanban({ trips, onStatusChange }: TripsKanbanProps) {
  const navigate = useNavigate();

  const tripsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = trips.filter((t) => t.status === col.id);
    return acc;
  }, {} as Record<string, Trip[]>);

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    const trip = trips.find((t) => t.id === draggableId);
    if (!trip || trip.status === newStatus) return;
    await onStatusChange(draggableId, newStatus);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
        {KANBAN_COLUMNS.map((col) => (
          <Droppable droppableId={col.id} key={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-shrink-0 w-[320px] flex flex-col rounded-lg border-t-4 ${col.color} ${
                  snapshot.isDraggingOver ? "bg-accent/40" : "bg-muted/30"
                } transition-colors`}
              >
                <div className="px-3.5 py-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">{col.label}</h3>
                  <span className="text-sm text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                    {tripsByStatus[col.id]?.length || 0}
                  </span>
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
  );
}

function KanbanTripCard({ trip }: { trip: Trip }) {
  return (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${trip.isOptimistic ? "opacity-60 animate-pulse" : ""}`}>
      {trip.cover_image_url && (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={trip.cover_image_url}
            alt={trip.trip_name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4.5 space-y-3">
        <h4 className="font-semibold text-[18px] leading-snug line-clamp-2">
          {trip.isOptimistic && <Loader2 className="inline h-4 w-4 animate-spin mr-1" />}
          {trip.trip_name}
        </h4>
        {trip.trip_type && trip.trip_type !== "regular" && (
          <p className="text-[14px] text-muted-foreground italic">{trip.trip_type}</p>
        )}
        {trip.clients?.name && (
          <p className="text-[14px] text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {trip.clients.name}
          </p>
        )}
        {trip.depart_date && (
          <p className="text-[14px] text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(trip.depart_date), "MMM d")}
            {trip.return_date && ` - ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
          </p>
        )}
        {trip.destination && (
          <p className="text-[14px] text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {trip.destination}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
