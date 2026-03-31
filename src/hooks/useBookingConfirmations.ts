import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BookingConfirmation {
  id: string;
  booking_id: string;
  pdf_filename: string | null;
  extracted_reservation_id: string | null;
  extracted_cruise_line: string | null;
  extracted_ship: string | null;
  extracted_sailing_date: string | null;
  extracted_itinerary: string | null;
  extracted_stateroom: string | null;
  extracted_guests: number | null;
  extracted_gross_charges: number | null;
  extracted_commission_amount: number | null;
  extracted_commission_rate: number | null;
  extracted_net_charges: number | null;
  extracted_json: Record<string, any>;
  recon_status: "pending" | "matched" | "mismatch" | "accepted" | "skipped";
  gross_variance: number;
  commission_variance: number;
  net_variance: number;
  recon_notes: string | null;
  extracted_at: string | null;
  created_at: string;
}

export function useBookingConfirmation(bookingId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const QK = ["booking-confirmation", bookingId];

  const { data: confirmation, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_confirmations")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (error) throw error;
      return data as BookingConfirmation | null;
    },
    enabled: !!bookingId && !!user,
  });

  // Upload PDF, call edge function to extract + reconcile
  const uploadConfirmation = useMutation({
    mutationFn: async (file: File) => {
      if (!bookingId) throw new Error("No booking ID");

      // Convert PDF to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data URL prefix — just the base64 data
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call the edge function
      const { data, error } = await (supabase as any).functions.invoke(
        "parse-booking-confirmation",
        {
          body: {
            booking_id:   bookingId,
            pdf_base64:   base64,
            pdf_filename: file.name,
          },
        }
      );

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "Extraction failed");

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QK });
      const status = data.reconciliation?.status;
      if (status === "matched") {
        toast.success("Confirmation matched — financials are correct");
      } else if (status === "mismatch") {
        toast.warning("Confirmation imported — discrepancies found, review below");
      } else {
        toast.success("Confirmation imported successfully");
      }
    },
    onError: (err: Error) => toast.error(`Import failed: ${err.message}`),
  });

  // Accept the confirmed values — update booking financials from PDF
  const acceptConfirmedValues = useMutation({
    mutationFn: async () => {
      if (!confirmation || !bookingId) throw new Error("No confirmation");

      // Update booking with confirmed values from PDF
      const { error: bookingErr } = await (supabase as any)
        .from("bookings")
        .update({
          gross_sales:        confirmation.extracted_gross_charges,
          commission_revenue: confirmation.extracted_commission_amount,
          supplier_payout:    confirmation.extracted_net_charges,
          confirmation_number: confirmation.extracted_reservation_id
            ?? undefined,
        })
        .eq("id", bookingId);

      if (bookingErr) throw bookingErr;

      // Mark as accepted
      const { error: reconErr } = await (supabase as any)
        .from("booking_confirmations")
        .update({
          recon_status:   "accepted",
          reconciled_at:  new Date().toISOString(),
          recon_notes:    "Agent accepted confirmed values from PDF",
        })
        .eq("id", confirmation.id);

      if (reconErr) throw reconErr;

      // Recalculate margin with confirmed numbers
      await (supabase as any).rpc("calculate_booking_margin", {
        p_booking_id:   bookingId,
        p_force_recalc: true,
        p_triggered_by: "manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      toast.success("Booking updated with confirmed values from PDF");
    },
    onError: () => toast.error("Failed to apply confirmed values"),
  });

  const dismissMismatch = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await (supabase as any)
        .from("booking_confirmations")
        .update({
          recon_status:  "skipped",
          recon_notes:   notes,
          reconciled_at: new Date().toISOString(),
        })
        .eq("id", confirmation?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK });
      toast.success("Discrepancy noted");
    },
  });

  return {
    confirmation,
    isLoading,
    uploadConfirmation,
    acceptConfirmedValues,
    dismissMismatch,
  };
}
