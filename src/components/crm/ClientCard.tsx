import { Mail, Phone, MapPin, Cake } from "lucide-react";
import { Client } from "@/hooks/useClients";
import { format, differenceInYears } from "date-fns";
import { useNavigate } from "react-router-dom";
import { parseLocalDate } from "@/lib/utils";
import { Panel } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

interface ClientCardProps {
  client: Client & {
    totalBookings: number;
    totalSpent: number;
  };
}

const STATUS_META: Record<string, { status: SemanticStatus; label: string }> = {
  active: { status: "success", label: "Active" },
  lead: { status: "info", label: "Lead" },
  travelling: { status: "warning", label: "Travelling" },
  traveled: { status: "muted", label: "Traveled" },
  inactive: { status: "muted", label: "Inactive" },
  cancelled: { status: "destructive", label: "Cancelled" },
  blacklisted: { status: "destructive", label: "🚫 Blacklisted" },
};

export function ClientCard({ client }: ClientCardProps) {
  const navigate = useNavigate();

  const displayName = client.preferred_first_name
    ? `${client.preferred_first_name} ${client.last_name || ''}`
    : client.name;

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatBirthday = (birthday: string | null) => {
    if (!birthday) return null;
    const date = parseLocalDate(birthday);
    const age = differenceInYears(new Date(), date);
    return `${format(date, "MMM d")} (${age}y)`;
  };

  const fullName = client.title
    ? `${client.title} ${client.first_name || ''} ${client.last_name || ''}`.trim()
    : client.name;

  const statusMeta = STATUS_META[client.status] ?? { status: "muted" as SemanticStatus, label: client.status };

  return (
    <Panel
      className="group cursor-pointer p-[14px] transition-shadow hover:shadow-lg"
      onClick={() => navigate(`/contacts/${client.id}`)}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="text-[14.5px] font-semibold text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-card-foreground">{fullName}</p>
            <SemanticStatusPill status={statusMeta.status} label={statusMeta.label} className="mt-1" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-[13px]">
        {client.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{client.location}</span>
          </div>
        )}
        {client.birthday && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cake className="h-3.5 w-3.5 shrink-0" />
            <span>{formatBirthday(client.birthday)}</span>
          </div>
        )}
        {!client.email && !client.phone && !client.location && !client.birthday && (
          <p className="italic text-muted-foreground">No contact info added</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Bookings</p>
          <p className="text-[14.5px] font-semibold text-card-foreground">
            {client.totalBookings}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Total Spent</p>
          <p className="text-[14.5px] font-semibold text-card-foreground">
            {formatCurrency(client.totalSpent)}
          </p>
        </div>
      </div>
    </Panel>
  );
}
