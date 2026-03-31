import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plane, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Search, Eye, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface FlightOrder {
  id: string;
  duffel_order_id: string;
  booking_reference: string | null;
  trip_id: string | null;
  client_id: string | null;
  passenger_names: string[] | null;
  passenger_emails: string[] | null;
  origin_iata: string | null;
  destination_iata: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  airline_name: string | null;
  flight_numbers: string[] | null;
  total_amount: number;
  total_currency: string;
  order_status: string;
  last_event_type: string | null;
  last_event_at: string | null;
  event_log: any[];
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  confirmed: { label: "Confirmed", variant: "default", icon: CheckCircle2 },
  schedule_changed: { label: "Schedule Changed", variant: "secondary", icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  pending: { label: "Pending", variant: "outline", icon: Clock },
};

export default function FlightMonitoring() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<FlightOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<FlightOrder | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("flight_orders")
      .select("*")
      .order("departure_at", { ascending: true });

    if (error) {
      console.error("Error fetching flight orders:", error);
      toast.error("Failed to load flight orders");
    } else {
      setOrders((data as unknown as FlightOrder[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("flight-orders-monitoring")
      .on("postgres_changes", { event: "*", schema: "public", table: "flight_orders" }, (payload) => {
        console.log("Flight order update:", payload);
        fetchOrders();
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as unknown as FlightOrder;
          if (updated.last_event_type) {
            toast.info(`Flight ${updated.origin_iata} → ${updated.destination_iata}: ${updated.last_event_type}`);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleRefreshOrder = async (order: FlightOrder) => {
    setRefreshingId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("duffel-flights", {
        body: { action: "get_order", order_id: order.duffel_order_id },
      });
      if (error) throw error;
      const duffelOrder = data?.data;
      if (duffelOrder) {
        // Update local record with latest data
        const slices = duffelOrder.slices || [];
        const firstSlice = slices[0];
        const lastSlice = slices[slices.length - 1];
        const flightNumbers = slices.flatMap((s: any) =>
          s.segments.map((seg: any) => `${seg.operating_carrier.iata_code}${seg.operating_carrier_flight_number}`)
        );

        await supabase
          .from("flight_orders")
          .update({
            departure_at: firstSlice?.segments?.[0]?.departing_at || order.departure_at,
            arrival_at: lastSlice?.segments?.slice(-1)?.[0]?.arriving_at || order.arrival_at,
            flight_numbers: flightNumbers,
          })
          .eq("id", order.id);

        toast.success("Flight data refreshed from Duffel");
        fetchOrders();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh order");
    } finally {
      setRefreshingId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      order.booking_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.passenger_names?.some((n) => n.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.origin_iata?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.destination_iata?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.airline_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    confirmed: orders.filter((o) => o.order_status === "confirmed").length,
    scheduleChanged: orders.filter((o) => o.order_status === "schedule_changed").length,
    cancelled: orders.filter((o) => o.order_status === "cancelled").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Flight Monitoring
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track flight statuses, schedule changes, and disruptions in real-time
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Flights</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Plane className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Schedule Changed</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.scheduleChanged}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-600/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, reference, airport..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="schedule_changed">Schedule Changed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1" onClick={fetchOrders}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading flights...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Plane className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No flight orders found</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Flight orders will appear here after booking through Duffel
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Passengers</TableHead>
                    <TableHead>Airline / Flights</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Event</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const config = statusConfig[order.order_status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-medium">
                            {order.origin_iata} → {order.destination_iata}
                          </div>
                          {order.booking_reference && (
                            <div className="text-xs text-muted-foreground">Ref: {order.booking_reference}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {(order.passenger_names || []).map((name, i) => (
                              <div key={i}>{name}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{order.airline_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {(order.flight_numbers || []).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.departure_at ? (
                            <div>
                              <div className="text-sm">{format(new Date(order.departure_at), "MMM d, yyyy")}</div>
                              <div className="text-xs text-muted-foreground">{format(new Date(order.departure_at), "h:mm a")}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.last_event_at ? (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(order.last_event_at), "MMM d, h:mm a")}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleRefreshOrder(order)}
                              disabled={refreshingId === order.id}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === order.id ? "animate-spin" : ""}`} />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedOrder(order)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>
                                    Flight Details: {order.origin_iata} → {order.destination_iata}
                                  </DialogTitle>
                                </DialogHeader>
                                <OrderDetailView order={order} />
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function OrderDetailView({ order }: { order: FlightOrder }) {
  const config = statusConfig[order.order_status] || statusConfig.pending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Booking Ref</span>
          <p className="font-medium">{order.booking_reference || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Airline</span>
          <p className="font-medium">{order.airline_name || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Amount</span>
          <p className="font-medium">{order.total_currency} {order.total_amount}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Departure</span>
          <p className="font-medium">{order.departure_at ? format(new Date(order.departure_at), "MMM d, yyyy h:mm a") : "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Arrival</span>
          <p className="font-medium">{order.arrival_at ? format(new Date(order.arrival_at), "MMM d, yyyy h:mm a") : "—"}</p>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-2">Passengers</h4>
        {(order.passenger_names || []).map((name, i) => (
          <div key={i} className="text-sm flex items-center justify-between">
            <span>{name}</span>
            <span className="text-muted-foreground text-xs">{order.passenger_emails?.[i] || ""}</span>
          </div>
        ))}
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <Bell className="h-3.5 w-3.5" />
          Event Log
        </h4>
        <ScrollArea className="h-[200px]">
          {Array.isArray(order.event_log) && order.event_log.length > 0 ? (
            <div className="space-y-2">
              {[...order.event_log].reverse().map((event: any, i: number) => (
                <div key={i} className="border rounded-md p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{event.summary || event.type}</span>
                    <span className="text-muted-foreground">
                      {event.timestamp ? format(new Date(event.timestamp), "MMM d, h:mm a") : ""}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{event.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No events recorded yet</p>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
