import { ItineraryGallery, getItemImages } from "@/components/shared/ItineraryGallery";
import { useState } from "react";
import { SafeHtml } from "@/components/ui/rich-text-editor";
import { Clock, MapPin, CheckCircle2 } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";

interface SharedTripItineraryProps {
  itinerary: any[];
  departDate: string | null;
  primaryColor: string;
  optionBlocks?: any[];
}

const categoryIcons: Record<string, string> = {
  flight: "✈️", hotel: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", sightseeing: "📸", relaxation: "💆",
  shopping: "🛍️", entertainment: "🎵", meeting: "📋", other: "📌",
};

const optionLabels = ["A", "B", "C", "D", "E", "F"];

function OptionBlockClient({ block, items, primaryColor }: { block: any; items: any[]; primaryColor: string }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (items.length === 0) return null;

  // Find the cheapest option as the "starting from" price
  const pricedItems = items.filter((i: any) => i.item_price != null);
  const cheapestPrice = pricedItems.length > 0 ? Math.min(...pricedItems.map((i: any) => i.item_price)) : null;
  const selectedItem = items.find((i: any) => i.id === selected);
  const selectedPrice = selectedItem?.item_price;

  return (
    <div className="rounded-xl border-2 border-dashed p-4 space-y-3" style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}08` }}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{block.title}</span>
        <span className="text-xs text-gray-400">· {items.length} options</span>
        {cheapestPrice != null && !selected && (
          <span className="text-xs font-medium ml-auto" style={{ color: primaryColor }}>
            from ${cheapestPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )}
        {selectedPrice != null && selected && (
          <span className="text-xs font-bold ml-auto" style={{ color: primaryColor }}>
            ${selectedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item: any, idx: number) => {
          const isSelected = selected === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-current shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
            >
              <div className="flex items-start gap-3">
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{
                    backgroundColor: isSelected ? primaryColor : "#e5e7eb",
                    color: isSelected ? "white" : "#6b7280",
                  }}
                >
                  {isSelected ? <CheckCircle2 className="h-4 w-4" /> : optionLabels[idx] || (idx + 1).toString()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{categoryIcons[item.category] || "📌"}</span>
                    <h5 className="font-semibold text-gray-900">{item.title}</h5>
                    {item.item_price != null && (
                      <span className="text-xs font-medium ml-auto whitespace-nowrap" style={{ color: isSelected ? primaryColor : '#6b7280' }}>
                        +${item.item_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <SafeHtml html={item.description} className="text-sm text-gray-500 mt-0.5" />
                  )}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                    {item.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {item.start_time.slice(0, 5)}
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {item.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SharedTripItinerary({ itinerary, departDate, primaryColor, optionBlocks = [] }: SharedTripItineraryProps) {
  if (itinerary.length === 0 && optionBlocks.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-lg">No itinerary items published yet.</p>
      </div>
    );
  }

  // Filter out items hidden from traveler view
  const visibleItinerary = itinerary.filter((i: any) => !i.is_hidden);

  // Separate regular items from option block items
  const regularItems: any[] = [];
  const optionBlockItemMap: Record<string, any[]> = {};
  for (const item of visibleItinerary) {
    if (item.option_block_id) {
      if (!optionBlockItemMap[item.option_block_id]) optionBlockItemMap[item.option_block_id] = [];
      optionBlockItemMap[item.option_block_id].push(item);
    } else {
      regularItems.push(item);
    }
  }

  const dayGroups: Record<number, any[]> = {};
  for (const item of regularItems) {
    if (!dayGroups[item.day_number]) dayGroups[item.day_number] = [];
    dayGroups[item.day_number].push(item);
  }

  // Group option blocks by day
  const dayBlocksMap: Record<number, any[]> = {};
  for (const block of optionBlocks) {
    if (!dayBlocksMap[block.day_number]) dayBlocksMap[block.day_number] = [];
    dayBlocksMap[block.day_number].push(block);
  }

  // Collect all days
  const allDays = new Set<number>();
  regularItems.forEach(i => allDays.add(i.day_number));
  optionBlocks.forEach(b => allDays.add(b.day_number));

  return (
    <div className="space-y-10">
      {Array.from(allDays)
        .sort((a, b) => a - b)
        .map((day) => {
          const items = dayGroups[day] || [];
          const blocks = dayBlocksMap[day] || [];
          const dateStr = departDate
            ? format(addDays(parseISO(departDate), day - 1), "EEE, MMM d")
            : null;
          const locationStr = items.find((i: any) => i.location)?.location;

          return (
            <div key={day}>
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

              <div className="space-y-6">
                {items.map((item: any) =>
                  getItemImages(item).length > 0 ? (
                    /* ── Image card with text overlay ── */
                    <div key={item.id} className="space-y-3">
                    <div
                      className="relative rounded-2xl overflow-hidden shadow-md group cursor-default"
                      style={{ minHeight: 220 }}
                    >
                      <img
                        src={getItemImages(item)[0]?.url}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                      {/* Category pill — top left */}
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white backdrop-blur-sm bg-black/30 border border-white/20">
                          <span>{categoryIcons[item.category] || "📌"}</span>
                          <span className="capitalize">{item.category}</span>
                        </span>
                      </div>
                      {/* Time pill — top right */}
                      {item.start_time && (
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white backdrop-blur-sm bg-black/30 border border-white/20">
                            <Clock className="h-3 w-3" />
                            {item.start_time.slice(0, 5)}
                            {item.end_time && ` – ${item.end_time.slice(0, 5)}`}
                          </span>
                        </div>
                      )}
                      {/* Text overlay — bottom */}
                      <div className="relative px-5 pb-5 pt-16">
                        <h4 className="text-xl font-bold text-white drop-shadow-md leading-tight">{item.title}</h4>
                        {item.location && (
                          <p className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            {item.location}
                          </p>
                        )}
                        {item.description && (
                          <SafeHtml
                            html={item.description}
                            className="text-white/70 text-sm mt-2 leading-relaxed line-clamp-3 [&_a]:text-white/90 [&_strong]:text-white [&_ul]:pl-3 [&_ol]:pl-3"
                          />
                        )}
                        {item.item_price != null && (
                          <p className="text-sm font-bold mt-3" style={{ color: "#facc15" }}>
                            ${item.item_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>
                    {getItemImages(item).length > 1 && (
                      <ItineraryGallery
                        images={getItemImages(item).slice(1)}
                        alt={item.title}
                        aspectClassName="aspect-[16/10]"
                      />
                    )}
                    </div>
                  ) : (
                    /* ── Text-only item (no image) ── */
                    <div key={item.id} className="pl-4 border-l-2" style={{ borderColor: `${primaryColor}40` }}>
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{categoryIcons[item.category] || "📌"}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900">{item.title}</h4>
                          {item.description && (
                            <SafeHtml
                              html={item.description}
                              className="text-gray-500 mt-1 leading-relaxed"
                            />
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
                          {item.item_price != null && (
                            <p className="text-sm font-bold mt-2" style={{ color: primaryColor }}>
                              ${item.item_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Option blocks */}
                {blocks.map((block: any) => (
                  <OptionBlockClient
                    key={block.id}
                    block={block}
                    items={optionBlockItemMap[block.id] || []}
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
