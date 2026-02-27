import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trip } from "./useTrips";

interface WorkflowContext {
  trip: Trip;
  bookings: any[];
}

export function useWorkflowAutomation() {
  const { user } = useAuth();

  const createWorkflowTask = useCallback(
    async (tripId: string, title: string, taskType: string, description?: string, dueAt?: Date) => {
      if (!user) return;
      await supabase.from("workflow_tasks").insert({
        trip_id: tripId,
        user_id: user.id,
        title,
        task_type: taskType,
        description: description || null,
        due_at: dueAt?.toISOString() || null,
      } as any);
    },
    [user]
  );

  const createNotification = useCallback(
    async (title: string, message: string, tripId?: string) => {
      if (!user) return;
      await supabase.from("agent_notifications").insert({
        user_id: user.id,
        type: "workflow",
        title,
        message,
        trip_id: tripId || null,
      });
    },
    [user]
  );

  /**
   * Validates and executes side effects for a status transition.
   * Returns { allowed: boolean, error?: string }
   */
  const processStatusChange = useCallback(
    async (
      newStatus: string,
      ctx: WorkflowContext
    ): Promise<{ allowed: boolean; error?: string }> => {
      const { trip, bookings } = ctx;
      const slug = newStatus;

      // === PROPOSAL SENT ===
      if (slug === "proposal_sent") {
        if (!trip.published_at) {
          return { allowed: false, error: "Trip must be published before sending a proposal" };
        }
        const hasPricedItem = bookings.some((b) => b.gross_sales > 0);
        if (!hasPricedItem) {
          return { allowed: false, error: "At least one priced booking must exist" };
        }

        // Set timestamps
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 7);

        await supabase
          .from("trips")
          .update({
            proposal_sent_at: new Date().toISOString(),
            follow_up_due_at: followUpDate.toISOString(),
          } as any)
          .eq("id", trip.id);

        await createWorkflowTask(
          trip.id,
          `Follow up on proposal for ${trip.trip_name}`,
          "follow_up",
          "7-day follow-up: check if client has reviewed the proposal",
          followUpDate
        );

        await createNotification(
          "Proposal Sent",
          `Proposal sent for "${trip.trip_name}". Follow-up due in 7 days.`,
          trip.id
        );

        return { allowed: true };
      }

      // === OPTION SELECTED ===
      if (slug === "option_selected") {
        await createWorkflowTask(
          trip.id,
          `Prepare Deposit Invoice for ${trip.trip_name}`,
          "prepare_invoice",
          "Client selected an option. Prepare and send the deposit invoice."
        );

        await createNotification(
          "Option Selected",
          `Client selected an option for "${trip.trip_name}". Prepare deposit invoice.`,
          trip.id
        );

        return { allowed: true };
      }

      // === DEPOSIT AUTHORIZED ===
      if (slug === "deposit_authorized") {
        await createWorkflowTask(
          trip.id,
          `Charge Card for ${trip.trip_name}`,
          "charge_card",
          "Client authorized deposit payment. Process the charge."
        );

        await createNotification(
          "Deposit Authorized",
          `Client authorized deposit for "${trip.trip_name}". Ready to charge.`,
          trip.id
        );

        // Log compliance audit
        if (user) {
          await supabase.from("compliance_audit_log").insert({
            user_id: user.id,
            entity_type: "trip",
            entity_id: trip.id,
            event_type: "terms_accepted",
            client_name: trip.clients?.name || null,
            metadata: { status_transition: "deposit_authorized", trip_name: trip.trip_name },
          } as any);
        }

        return { allowed: true };
      }

      // === DEPOSIT PAID ===
      if (slug === "deposit_paid") {
        await createWorkflowTask(
          trip.id,
          `Complete bookings for ${trip.trip_name}`,
          "booking_completion",
          "Deposit received. Confirm all bookings with suppliers."
        );

        await createNotification(
          "Deposit Paid",
          `Deposit received for "${trip.trip_name}". Confirm bookings.`,
          trip.id
        );

        return { allowed: true };
      }

      // === FINAL PAID ===
      if (slug === "final_paid") {
        await createWorkflowTask(
          trip.id,
          `Confirm Supplier Payments for ${trip.trip_name}`,
          "supplier_confirmation",
          "Final payment received. Verify all supplier payments are complete."
        );

        await createNotification(
          "Final Payment Received",
          `Final payment received for "${trip.trip_name}". Confirm supplier payments.`,
          trip.id
        );

        return { allowed: true };
      }

      // All other statuses pass through
      return { allowed: true };
    },
    [user, createWorkflowTask, createNotification]
  );

  /**
   * Check if a payment event should trigger an automatic status transition.
   */
  const handlePaymentStatusChange = useCallback(
    async (tripId: string, paymentType: string, currentTripStatus: string) => {
      const depositStatuses = ["option_selected", "deposit_authorized"];
      if (paymentType === "deposit" && depositStatuses.includes(currentTripStatus)) {
        return "deposit_paid";
      }
      if (
        (paymentType === "final_balance" || paymentType === "payment") &&
        currentTripStatus === "deposit_paid"
      ) {
        return "final_paid";
      }
      return null;
    },
    []
  );

  return {
    processStatusChange,
    handlePaymentStatusChange,
    createWorkflowTask,
  };
}
