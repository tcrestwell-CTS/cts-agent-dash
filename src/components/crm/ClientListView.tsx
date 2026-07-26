import { Mail, Phone, MapPin } from "lucide-react";
import { Client } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { Panel } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";

interface ClientListViewProps {
  clients: (Client & { totalBookings: number; totalSpent: number })[];
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export function ClientListView({ clients }: ClientListViewProps) {
  const navigate = useNavigate();

  return (
    <Panel className="overflow-hidden">
      <div className="table-scroll-mobile">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th className="data-table-secondary-col">Email</th>
              <th className="data-table-secondary-col">Phone</th>
              <th className="data-table-secondary-col">Location</th>
              <th className="data-table-money">Bookings</th>
              <th className="data-table-money">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const displayName = client.preferred_first_name
                ? `${client.preferred_first_name} ${client.last_name || ""}`
                : client.name;
              const initials = displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const statusMeta = STATUS_META[client.status] ?? { status: "muted" as SemanticStatus, label: client.status };

              return (
                <tr
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/contacts/${client.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-[11.5px] font-semibold text-primary">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-card-foreground">{displayName}</span>
                        <span className="block data-table-secondary md:hidden">
                          {client.email || client.phone || client.location || ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <SemanticStatusPill status={statusMeta.status} label={statusMeta.label} />
                  </td>
                  <td className="data-table-secondary-col">
                    {client.email ? (
                      <div className="flex items-center gap-1.5 data-table-secondary">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[200px]">{client.email}</span>
                      </div>
                    ) : (
                      <span className="data-table-secondary">—</span>
                    )}
                  </td>
                  <td className="data-table-secondary-col">
                    {client.phone ? (
                      <div className="flex items-center gap-1.5 data-table-secondary">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.phone}</span>
                      </div>
                    ) : (
                      <span className="data-table-secondary">—</span>
                    )}
                  </td>
                  <td className="data-table-secondary-col">
                    {client.location ? (
                      <div className="flex items-center gap-1.5 data-table-secondary">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{client.location}</span>
                      </div>
                    ) : (
                      <span className="data-table-secondary">—</span>
                    )}
                  </td>
                  <td className="data-table-money font-semibold text-card-foreground">
                    {client.totalBookings}
                  </td>
                  <td className="data-table-money font-semibold text-card-foreground">
                    {formatCurrency(client.totalSpent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
