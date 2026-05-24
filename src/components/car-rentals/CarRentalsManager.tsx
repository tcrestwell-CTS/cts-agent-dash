import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Car, Search, CheckCircle2, Clock, ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CarRentalDrawer } from "./CarRentalDrawer";
import {
  CAR_RENTAL_PROVIDERS,
  CAR_RENTAL_STATUSES,
  getProviderMeta,
  getStatusBadgeClasses,
  getStatusLabel,
} from "@/lib/carRentalProviders";

type Row = {
  id: string;
  status: string | null;
  pickup_date: string;
  pickup_time: string;
  pickup_location: string;
  dropoff_location: string | null;
  return_date: string | null;
  return_time: string | null;
  driver_name: string;
  driver_email: string;
  provider: string;
  vehicle_class: string;
  trip_type: string;
  cc_authorized: boolean | null;
  cc_auth_stripe_pm_id: string | null;
  assigned_agent: string | null;
  client_id: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 25;

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(parseLocalDate(d) ?? new Date(d), "MMM d, yyyy");
  } catch {
    return d;
  }
}

export function CarRentalsManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: [
      "car-rentals",
      { statusFilter, providerFilter, search, from, to },
    ],
    queryFn: async () => {
      let q = supabase
        .from("car_rental_requests")
        .select(
          "id,status,pickup_date,pickup_time,pickup_location,dropoff_location,return_date,return_time,driver_name,driver_email,provider,vehicle_class,trip_type,cc_authorized,cc_auth_stripe_pm_id,assigned_agent,client_id,created_at"
        )
        .order("pickup_date", { ascending: false })
        .limit(PAGE_SIZE * 4);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (providerFilter !== "all") q = q.ilike("provider", providerFilter);
      if (search.trim()) q = q.ilike("driver_name", `%${search.trim()}%`);
      if (from) q = q.gte("pickup_date", format(from, "yyyy-MM-dd"));
      if (to) q = q.lte("pickup_date", format(to, "yyyy-MM-dd"));

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const totals = useMemo(() => {
    const t = { new: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0 } as Record<string, number>;
    rows.forEach((r) => {
      const s = (r.status || "new").toLowerCase();
      if (t[s] !== undefined) t[s]++;
    });
    return t;
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Car Rentals
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage rental car requests submitted from the public site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CAR_RENTAL_STATUSES.map((s) => (
            <Badge
              key={s}
              variant="outline"
              className={cn("cursor-pointer", getStatusBadgeClasses(s))}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            >
              {getStatusLabel(s)} · {totals[s] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search driver name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[220px]"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CAR_RENTAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {getStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {CAR_RENTAL_PROVIDERS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeField label="From" value={from} onChange={setFrom} />
        <DateRangeField label="To"   value={to}   onChange={setTo} />

        {(statusFilter !== "all" || providerFilter !== "all" || search || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setProviderFilter("all");
              setSearch("");
              setFrom(undefined);
              setTo(undefined);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pickup Date</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Trip Type</TableHead>
              <TableHead>Pickup → Drop-off</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>CC Auth</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  Loading rental requests…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  No car rental requests match your filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const prov = getProviderMeta(r.provider);
                const hasCc = r.cc_authorized || !!r.cc_auth_stripe_pm_id;
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{fmtDate(r.pickup_date)}</div>
                      <div className="text-xs text-muted-foreground">{r.pickup_time}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.driver_name}</div>
                      <div className="text-xs text-muted-foreground">{r.driver_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border", prov.classes)}>
                        {prov.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{r.vehicle_class}</TableCell>
                    <TableCell className="capitalize">
                      {r.trip_type?.replace(/[-_]/g, " ")}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-1 text-sm truncate">
                        <span className="truncate">{r.pickup_location}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate text-muted-foreground">
                          {r.dropoff_location || r.pickup_location}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClasses(r.status)}>
                        {getStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasCc ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle2 className="h-4 w-4" /> Authorized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                          <Clock className="h-4 w-4" /> Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.assigned_agent ? (
                        <span className="truncate">{r.assigned_agent.slice(0, 8)}…</span>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(r.id);
                        }}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CarRentalDrawer
        rentalId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onUpdated={() => refetch()}
      />
    </div>
  );
}

function DateRangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "justify-start font-normal w-[150px]",
            !value && "text-muted-foreground"
          )}
        >
          {value ? `${label}: ${format(value, "MMM d")}` : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value && (
          <div className="p-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)} className="w-full">
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}