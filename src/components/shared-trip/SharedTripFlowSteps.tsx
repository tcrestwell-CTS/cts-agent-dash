import { CheckCircle2, FileText, DollarSign, CreditCard, Lock } from "lucide-react";

type StepState = "done" | "active" | "upcoming";

interface Props {
  /** Has the client picked an itinerary? */
  itinerarySelected: boolean;
  /** Has the client confirmed the budget? */
  budgetConfirmed: boolean;
  /** Has the client accepted terms / authorized payment? */
  paymentReady: boolean;
  primaryColor: string;
}

/**
 * Top-of-page "How this works" card shown on the public shared-trip view.
 * Tells the client the 3-step process upfront so the page never feels ambiguous.
 */
export default function SharedTripFlowSteps({
  itinerarySelected,
  budgetConfirmed,
  paymentReady,
  primaryColor,
}: Props) {
  const step1: StepState = itinerarySelected ? "done" : "active";
  const step2: StepState = budgetConfirmed ? "done" : itinerarySelected ? "active" : "upcoming";
  const step3: StepState = paymentReady ? "done" : budgetConfirmed ? "active" : "upcoming";

  const steps = [
    {
      n: 1,
      title: "Pick your itinerary",
      desc: "Review the option(s) below and tap Choose This Option to lock it in.",
      icon: FileText,
      state: step1,
    },
    {
      n: 2,
      title: "Confirm the budget",
      desc: "Sign off on the proposed pricing so we can secure your reservations.",
      icon: DollarSign,
      state: step2,
    },
    {
      n: 3,
      title: "Authorize payment",
      desc: "Pay by card, finance with Affirm, or send your card securely to your advisor.",
      icon: CreditCard,
      state: step3,
    },
  ];

  const activeStep = steps.find((s) => s.state === "active");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div
        className="px-5 py-3 text-white flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <p className="text-sm font-semibold tracking-wide uppercase">How this works</p>
        {activeStep && (
          <p className="text-xs opacity-90">
            You're on step {activeStep.n} of 3
          </p>
        )}
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {steps.map((s) => {
          const isDone = s.state === "done";
          const isActive = s.state === "active";
          const Icon = isDone ? CheckCircle2 : s.state === "upcoming" ? Lock : s.icon;

          return (
            <li
              key={s.n}
              className={`relative p-4 flex gap-3 transition-colors ${
                isActive ? "bg-amber-50/60" : isDone ? "bg-white" : "bg-gray-50/60"
              }`}
            >
              {/* Number badge */}
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border"
                style={
                  isDone
                    ? { backgroundColor: primaryColor, color: "white", borderColor: primaryColor }
                    : isActive
                    ? { backgroundColor: "#f59e0b", color: "white", borderColor: "#f59e0b" }
                    : { backgroundColor: "white", color: "#9ca3af", borderColor: "#e5e7eb" }
                }
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : s.n}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      isDone
                        ? "text-gray-400"
                        : isActive
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                    style={isDone ? { color: primaryColor } : undefined}
                  />
                  <p
                    className={`text-sm font-semibold ${
                      isActive ? "text-amber-700" : "text-gray-900"
                    }`}
                  >
                    {s.title}
                  </p>
                  {isActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500 text-white">
                      Do this next
                    </span>
                  )}
                  {isDone && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}