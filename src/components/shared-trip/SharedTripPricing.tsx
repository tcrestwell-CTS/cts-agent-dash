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
  deposit_amount?: number;
  is_optional?: boolean;
}

interface SharedTripPricingProps {
  pricingLines: PricingLine[];
  totalCost: number;
  primaryColor: string;
  termsAccepted?: boolean;
  onTotalChange?: (total: number, deposit: number) => void;
}

import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export default function SharedTripPricing({ pricingLines, totalCost, primaryColor, termsAccepted, onTotalChange }: SharedTripPricingProps) {
  // Track which optional add-ons are enabled (all on by default)
  const [enabledAddons, setEnabledAddons] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    pricingLines.filter(l => l.is_addon).forEach(l => { initial[l.id] = true; });
    return initial;
  });
  const [collapsed, setCollapsed] = useState(false);

  const toggleAddon = useCallback((id: string) => {
    setEnabledAddons(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Calculate active total
  const activeLines = pricingLines.filter(l => !l.is_addon || enabledAddons[l.id]);
  const grandTotal = activeLines.length > 0
    ? activeLines.reduce((sum, l) => sum + ((l.unit_price || 0) * (l.quantity || 1) * (l.travelers || 1)), 0)
    : totalCost;
  const depositTotal = activeLines.reduce((sum, l) => sum + (l.deposit_amount || 0), 0);

  // Notify parent of total changes
  useEffect(() => {
    onTotalChange?.(grandTotal, depositTotal);
  }, [grandTotal, depositTotal, onTotalChange]);

  // Calculate per-person price
  const travelers = pricingLines[0]?.travelers || 1;
  const perPerson = grandTotal / travelers;

  if (pricingLines.length === 0 && totalCost <= 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Pricing details are not yet available.</p>
      </div>
    );
  }

  // Post-authorization: collapsed view
  if (termsAccepted && collapsed) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Pricing Confirmed
          </h2>
          <button onClick={() => setCollapsed(false)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
            View details <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div
          className="flex items-center justify-between py-4 px-4 rounded-lg"
          style={{ backgroundColor: `${primaryColor}10`, borderLeft: `4px solid ${primaryColor}` }}
        >
          <p className="font-bold text-gray-900">Total</p>
          <p className="text-lg font-bold" style={{ color: primaryColor }}>
            ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Pricing Breakdown</h2>
        {termsAccepted && (
          <button onClick={() => setCollapsed(true)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
            Collapse <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </div>

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
                {coreLines.map(line => {
                  const lineTotal = (line.unit_price || 0) * (line.quantity || 1) * (line.travelers || 1);
                  return (
                    <div key={line.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-gray-900">{line.description}</p>
                        {(line.quantity > 1 || (line.travelers || 1) > 1) && (
                          <p className="text-xs text-gray-400">
                            ${(line.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} × {line.quantity || 1} × {line.travelers || 1} {(line.travelers || 1) > 1 ? 'persons' : 'person'}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {addonLines.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-600 pt-2">Add-Ons</p>
                  <div className="divide-y divide-gray-100">
                    {addonLines.map(line => {
                      const lineTotal = (line.unit_price || 0) * (line.quantity || 1) * (line.travelers || 1);
                      const isEnabled = enabledAddons[line.id] !== false;
                      return (
                        <div key={line.id} className={`flex items-center justify-between py-3 transition-opacity ${!isEnabled ? 'opacity-40' : ''}`}>
                          <div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => toggleAddon(line.id)}
                                className="scale-75"
                              />
                              <p className="text-sm text-gray-900">{line.description}</p>
                            </div>
                            {(line.quantity > 1 || (line.travelers || 1) > 1) && (
                              <p className="text-xs text-gray-400 ml-10">
                                ${(line.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} × {line.quantity || 1} × {line.travelers || 1} {(line.travelers || 1) > 1 ? 'persons' : 'person'}
                              </p>
                            )}
                          </div>
                          <p className={`text-sm font-medium whitespace-nowrap ${isEnabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {isEnabled ? '' : '+'}${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
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
          {depositTotal > 0 && (
            <p className="text-xs text-gray-500">
              Deposit: ${depositTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}
          {travelers > 1 && (
            <p className="text-xs text-gray-500">
              Based on {travelers} persons — ${perPerson.toLocaleString(undefined, { minimumFractionDigits: 2 })} per person
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
