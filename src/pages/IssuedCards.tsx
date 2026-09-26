import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Search, ExternalLink, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { StripeVirtualCardButton } from "@/components/trips/StripeVirtualCardButton";

type IssuedCard = {
  payment_id: string;
  amount: number;
  virtual_card_id: string;
  virtual_card_status: string;
  payment_method_choice: string;
  created_at: string;
  trip_name: string | null;
  client_name: string | null;
  trip_id: string | null;
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export default function IssuedCards() {
  const [search, setSearch] = useState("");

  const { data: cards, isLoading } = useQuery({
    queryKey: ["issued-virtual-cards"],
    queryFn: async (): Promise<IssuedCard[]> => {
      const { data, error } = await supabase
        .from("trip_payments")
        .select(`
          id,
          amount,
          virtual_card_id,
          virtual_card_status,
          payment_method_choice,
          created_at,
          trip_id,
          trips:trip_id (
            trip_name,
            clients:client_id ( name )
          )
        `)
        .not("virtual_card_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p: any) => ({
        payment_id: p.id,
        amount: p.amount,
        virtual_card_id: p.virtual_card_id,
        virtual_card_status: p.virtual_card_status,
        payment_method_choice: p.payment_method_choice,
        created_at: p.created_at,
        trip_id: p.trip_id,
        trip_name: p.trips?.trip_name || null,
        client_name: p.trips?.clients?.name || null,
      }));
    },
  });

  const filtered = (cards || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.trip_name?.toLowerCase().includes(q) ||
      c.client_name?.toLowerCase().includes(q) ||
      c.virtual_card_id?.toLowerCase().includes(q)
    );
  });

  const totalIssued = (cards || []).length;
  const totalValue = (cards || []).reduce((sum, c) => sum + c.amount, 0);
  const stripeCount = (cards || []).filter((c) => c.payment_method_choice === "stripe").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
              Crestwell Travel Services
            </p>
            <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
              <CreditCard className="h-[17px] w-[17px] text-primary" />
              Issued Virtual Cards
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All Stripe Issuing virtual cards created for supplier payments.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Issued</p>
              <p className="text-2xl font-bold">{totalIssued}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Via Stripe Issuing</p>
              <p className="text-2xl font-bold">{stripeCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by trip, client, or card ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-card-search"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No virtual cards issued yet</p>
                <p className="text-sm mt-1">
                  Issue cards from a trip's payment panel when a client payment is confirmed.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client / Trip</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((card) => (
                    <TableRow key={card.payment_id} data-testid={`row-card-${card.payment_id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {card.client_name || "—"}
                          </p>
                          {card.trip_name && (
                            <p className="text-xs text-muted-foreground">{card.trip_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(card.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            card.payment_method_choice === "stripe"
                              ? "border-primary text-primary"
                              : "border-info text-info"
                          }
                        >
                          {card.payment_method_choice === "stripe" ? "Stripe Issuing" : "Affirm VCN"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            card.virtual_card_status === "ready"
                              ? "border-success text-success"
                              : "border-warning text-warning"
                          }
                        >
                          {card.virtual_card_status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {card.created_at
                          ? format(new Date(card.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {card.payment_method_choice === "affirm" && (
                            <StripeVirtualCardButton
                              provider="affirm"
                              paymentId={card.payment_id}
                              paymentStatus="paid"
                              amount={card.amount}
                              virtualCardId={card.virtual_card_id}
                              virtualCardStatus={card.virtual_card_status}
                            />
                          )}
                          {card.payment_method_choice === "stripe" && (
                            <>
                              <StripeVirtualCardButton
                                paymentId={card.payment_id}
                                paymentStatus="paid"
                                amount={card.amount}
                                virtualCardId={card.virtual_card_id}
                                virtualCardStatus={card.virtual_card_status}
                              />
                              <a
                                href={`https://dashboard.stripe.com/issuing/cards/${card.virtual_card_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Open in Stripe Dashboard"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          {card.trip_id && (
                            <Link
                              to={`/trips/${card.trip_id}`}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Go to trip"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
