import { DollarSign, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SharedTripInvestmentProps {
  trip: {
    total_cost: number | null;
    depart_date: string | null;
    notes: string | null;
  };
  deposit: {
    required: boolean;
    amount: number;
  };
  cancellationTerms: string[];
  paymentDeadlines: { label: string; date: string }[];
  primaryColor: string;
}

export default function SharedTripInvestment({
  trip,
  deposit,
  cancellationTerms,
  paymentDeadlines,
  primaryColor,
}: SharedTripInvestmentProps) {
  const totalCost = trip.total_cost || 0;
  const depositAmount = deposit.required ? deposit.amount : 0;
  const finalBalance = totalCost - depositAmount;

  if (totalCost <= 0) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Your Investment</h2>

      {/* Pricing Breakdown */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div
          className="px-6 py-5 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <p className="text-sm font-medium opacity-80">Total Trip Cost</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalCost)}</p>
        </div>

        <div className="divide-y divide-gray-100">
          {deposit.required && depositAmount > 0 && (
            <>
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Deposit Due</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(depositAmount)}</span>
              </div>
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Final Balance</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(finalBalance)}</span>
              </div>
            </>
          )}

          {/* Payment deadlines from bookings */}
          {paymentDeadlines.length > 0 && paymentDeadlines.map((deadline, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{deadline.label}</span>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {format(parseISO(deadline.date), "MMM d, yyyy")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* What's Included */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">What's Included</h3>
          <ul className="space-y-2">
            {["All accommodations as outlined", "Transfers & transportation", "Activities & experiences listed", "Travel advisor support"].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Not Included</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {["International airfare (unless specified)", "Travel insurance", "Personal expenses & gratuities", "Meals not specified in itinerary"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">–</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Cancellation Terms */}
      {cancellationTerms.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Cancellation Policy
          </h3>
          <ul className="space-y-2">
            {cancellationTerms.map((term, i) => (
              <li key={i} className="text-sm text-amber-700">{term}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
