import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Client, NextDeparture } from "@/hooks/useClients";
import { Panel } from "@/components/patterns/Panel";

interface ClientCardProps {
  client: Client & {
    totalBookings: number;
    totalSpent: number;
    nextDeparture: NextDeparture;
  };
}

const TIER_META: Record<string, { label: string; className: string }> = {
  explorer: { label: "EXPLORER", className: "bg-secondary text-secondary-foreground" },
  voyager:  { label: "VOYAGER",  className: "bg-info/15 text-info" },
  platinum: { label: "PLATINUM", className: "bg-primary/10 text-primary" },
  elite:    { label: "GOLD",     className: "bg-warning/15 text-warning" },
};

export function ClientCard({ client }: ClientCardProps) {
  const navigate = useNavigate();

  const displayName = client.preferred_first_name
    ? `${client.preferred_first_name} ${client.last_name || ""}`
    : client.name;

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const sinceYear = client.created_at ? format(new Date(client.created_at), "yyyy") : null;
  const tier = TIER_META[client.membership_tier] ?? TIER_META.explorer;

  return (
    <Panel
      className="group cursor-pointer p-[14px] transition-shadow hover:shadow-lg"
      onClick={() => navigate(`/contacts/${client.id}`)}
    >
      {/* Header: avatar, name, tier badge */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-[14.5px] font-semibold text-primary">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14.5px] font-semibold text-card-foreground">{displayName}</p>
            <span
              className={`shrink-0 rounded px-[6px] py-[1px] text-[10px] font-bold tracking-[.04em] ${tier.className}`}
            >
              {tier.label}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {sinceYear ? `Client since ${sinceYear}` : "New client"}
          </p>
        </div>
      </div>

      {/* Lifetime / Trips */}
      <div className="flex items-center gap-6 border-t border-border pt-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Lifetime</p>
          <p className="text-[14.5px] font-semibold text-card-foreground">{formatCurrency(client.totalSpent)}</p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Trips</p>
          <p className="text-[14.5px] font-semibold text-card-foreground">{client.totalBookings}</p>
        </div>
      </div>

      {/* Next departure */}
      {client.nextDeparture && (
        <div className="mt-3 rounded-[9px] bg-card-2 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
            Next Departure
          </p>
          <p className="text-[13px] font-medium text-card-foreground">
            {client.nextDeparture.tripName || client.nextDeparture.destination}
            {" · "}
            {format(new Date(client.nextDeparture.departureDate), "d MMM yyyy")}
          </p>
        </div>
      )}

      {/* Notes / preferences */}
      {client.notes ? (
        <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{client.notes}</p>
      ) : (
        !client.nextDeparture && (
          <p className="mt-3 italic text-[13px] text-muted-foreground">No contact info added</p>
        )
      )}
    </Panel>
  );
}
