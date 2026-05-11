import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schema = z.object({
  trip_id: z.string().uuid({ message: "Select a trip" }),
  payment_type: z.enum(["deposit", "installment", "balance_due", "final_payment", "custom"]),
  amount: z.number().positive({ message: "Amount must be greater than 0" }),
  due_date: z.string().min(1, "Due date is required"),
  details: z.string().max(500).optional(),
});

export function AddReminderDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tripQuery, setTripQuery] = useState("");
  const [tripId, setTripId] = useState("");
  const [paymentType, setPaymentType] = useState<string>("installment");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [details, setDetails] = useState("");

  const { data: trips } = useQuery({
    queryKey: ["trips-for-reminder", tripQuery],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("trips")
        .select("id, trip_name, destination, clients!trips_client_id_fkey(name)")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (tripQuery.trim()) q = q.ilike("trip_name", `%${tripQuery.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const tripOptions = useMemo(
    () =>
      (trips || []).map((t: any) => ({
        id: t.id,
        label: `${t.trip_name || "Trip"}${t.clients?.name ? ` — ${t.clients.name}` : ""}`,
      })),
    [trips]
  );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        trip_id: tripId,
        payment_type: paymentType as any,
        amount: Number(amount),
        due_date: dueDate,
        details: details || undefined,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message || "Invalid input");
      }
      const { error } = await supabase.from("trip_payments").insert({
        trip_id: parsed.data.trip_id,
        user_id: user!.id,
        amount: parsed.data.amount,
        due_date: parsed.data.due_date,
        payment_type: parsed.data.payment_type,
        status: "pending",
        details: parsed.data.details || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reminder added", description: "It now appears in the dashboard." });
      qc.invalidateQueries({ queryKey: ["payment-reminders"] });
      onOpenChange(false);
      setTripId(""); setAmount(""); setDueDate(""); setDetails(""); setTripQuery("");
    },
    onError: (err: any) => {
      toast({ title: "Could not add reminder", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Reminder</DialogTitle>
          <DialogDescription>
            Creates a pending payment on the selected trip. The client appears in this dashboard immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Find Trip</Label>
            <Input
              placeholder="Search by trip name..."
              value={tripQuery}
              onChange={(e) => setTripQuery(e.target.value)}
            />
            <Select value={tripId} onValueChange={setTripId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a trip" />
              </SelectTrigger>
              <SelectContent>
                {tripOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reminder Type</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="balance_due">Balance Due</SelectItem>
                  <SelectItem value="final_payment">Final Payment</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount Due ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Saving..." : "Add Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}