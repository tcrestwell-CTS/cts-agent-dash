import { Clock, MapPin } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";

interface SharedTripItineraryProps {
  itinerary: any[];
  departDate: string | null;
  primaryColor: string;
}

const categoryIcons: Record<string, string> = {
  flight: "✈️", hotel: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", sightseeing: "📸", relaxation: "💆",
  shopping: "🛍️", entertainment: "🎵", meeting: "📋", other: "📌",
};

export default function SharedTripItinerary({ itinerary, departDate, primaryColor }: SharedTripItineraryProps) {
  if (itinerary.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-lg">No itinerary items published yet.</p>
      </div>
    );
  }

  const dayGroups: Record<number, any[]> = {};
  for (const item of itinerary) {
    if (!dayGroups[item.day_number]) dayGroups[item.day_number] = [];
    dayGroups[item.day_number].push(item);
  }

  return (
    <div className="space-y-10">
      {Object.entries(dayGroups)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([day, items]) => {
          const dateStr = departDate
            ? format(addDays(parseISO(departDate), Number(day) - 1), "EEE, MMM d")
            : null;
          const locationStr = items.find((i: any) => i.location)?.location;

          return (
            <div key={day}>
              {/* Day header — matches Tern style */}
              <div className="border-b pb-3 mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Day {day}
                  {dateStr && (
                    <span className="font-normal text-gray-400 ml-2">· {dateStr}</span>
                  )}
                  {locationStr && (
                    <span className="font-normal text-gray-400 ml-2">· {locationStr}</span>
                  )}
                </h3>
              </div>

              {/* Items */}
              <div className="space-y-8">
                {items.map((item: any) => (
                  <div key={item.id} className="pl-4 border-l-2" style={{ borderColor: `${primaryColor}40` }}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{categoryIcons[item.category] || "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-gray-900">{item.title}</h4>

                        {item.description && (
                          <p className="text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                          {item.start_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {item.start_time.slice(0, 5)}
                              {item.end_time && ` – ${item.end_time.slice(0, 5)}`}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" /> {item.location}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-sm text-gray-400 mt-2 italic">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
