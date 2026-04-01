interface PricingLine {
  id: string;
  booking_id: string;
  booking_name?: string;
  description: string;
  line_type: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  is_addon: boolean;
  sort_order: number;
  travelers?: number;
}

interface SharedTripPricingProps {
  pricingLines: PricingLine[];
  totalCost: number;
  primaryColor: string;
}

export default function SharedTripPricing({ pricingLines, totalCost, primaryColor }: SharedTripPricingProps) {
  if (pricingLines.length === 0 && totalCost <= 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Pricing details are not yet available.</p>
      </div>
    );
  }

  // Group lines by booking
  const grouped = pricingLines.reduce((acc: Record<string, PricingLine[]>, line) => {
    const key = line.booking_id;
    (acc[key] = acc[key] || []).push(line);
    return acc;
  }, {});

  const bookingGroups = Object.entries(grouped);
  const grandTotal = pricingLines.length > 0
    ? pricingLines.reduce((sum, l) => sum + (l.total_price || 0), 0)
    : totalCost;

  // Calculate per-person price from the first booking's travelers count
  const travelers = pricingLines[0]?.travelers || 1;
  const perPerson = grandTotal / travelers;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Pricing Breakdown</h2>

      {bookingGroups.length > 0 ? (
        bookingGroups.map(([bookingId, lines]) => {
          const bookingName = lines[0]?.booking_name || "Booking";
          const coreLines = lines.filter(l => !l.is_addon);
          const addonLines = lines.filter(l => l.is_addon);

          return (
            <div key={bookingId} className="space-y-3">
              {bookingGroups.length > 1 && (
                <h3 className="text-base font-semibold text-gray-800">{bookingName}</h3>
              )}

              {/* Details header */}
              <p className="text-sm font-semibold text-gray-600">Details</p>

              <div className="divide-y divide-gray-100">
                {coreLines.map(line => (
                  <div key={line.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-gray-900">{line.description}</p>
                      {line.quantity > 1 && (
                        <p className="text-xs text-gray-400">{line.quantity} × ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                      ${(line.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / person
                    </p>
                  </div>
                ))}
              </div>

              {addonLines.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-600 pt-2">Add-Ons</p>
                  <div className="divide-y divide-gray-100">
                    {addonLines.map(line => (
                      <div key={line.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm text-gray-900">{line.description}</p>
                          {line.quantity > 1 && (
                            <p className="text-xs text-gray-400">{line.quantity} × ${line.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          ${(line.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / person
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })
      ) : (
        <div className="flex items-center justify-between py-3">
          <p className="text-sm text-gray-900">Trip Total</p>
          <p className="text-sm font-medium text-gray-900">
            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Grand total */}
      <div
        className="flex items-center justify-between py-4 px-4 rounded-lg mt-4"
        style={{ backgroundColor: `${primaryColor}10`, borderLeft: `4px solid ${primaryColor}` }}
      >
        <p className="font-bold text-gray-900">Total</p>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: primaryColor }}>
            ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {travelers > 1 && (
            <p className="text-xs text-gray-500">
              ${perPerson.toLocaleString(undefined, { minimumFractionDigits: 2 })} / person × {travelers}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
