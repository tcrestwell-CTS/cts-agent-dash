import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

      // === PROPOSAL SENT ===
      if (newStatus === "proposal_sent") {
        if (!trip.published_at) {
          return { allowed: false, error: "Trip must be published before sending a proposal" };
        }
        const hasPricedItem = bookings.some((b) => b.gross_sales > 0);
        if (!hasPricedItem) {
          return { allowed: false, error: "At least one priced booking must exist" };
        }

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
      if (newStatus === "option_selected") {
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
      if (newStatus === "deposit_authorized") {
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
      if (newStatus === "deposit_paid") {
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
      if (newStatus === "final_paid") {
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

      // === BOOKED ===
      if (newStatus === "booked") {
        // Validate: every booking must have supplier, confirmation #, price, and commission
        const invalidBookings = bookings.filter(
          (b) => !b.suppliers?.name || !b.booking_reference || b.gross_sales <= 0 || b.commission_revenue <= 0
        );
        if (invalidBookings.length > 0) {
          return {
            allowed: false,
            error: "All bookings must have a supplier, confirmation number, price, and expected commission before marking as Booked",
          };
        }

        // Create commission forecast entries for bookings that don't have one yet
        for (const booking of bookings) {
          const { data: existing } = await supabase
            .from("commissions")
            .select("id")
            .eq("booking_id", booking.id)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("commissions").insert({
              user_id: user!.id,
              booking_id: booking.id,
              amount: booking.commission_revenue,
              rate: booking.commissionable_amount > 0
                ? (booking.commission_revenue / booking.commissionable_amount) * 100
                : 0,
              status: "pending",
              expected_commission: booking.commission_revenue,
            });
          }
        }

        await createNotification(
          "All Bookings Confirmed",
          `All bookings for "${trip.trip_name}" are confirmed. Commission forecast entries created.`,
          trip.id
        );

        return { allowed: true };
      }

      // === TRAVELED ===
      if (newStatus === "traveled") {
        await createWorkflowTask(
          trip.id,
          `Reconcile commissions for ${trip.trip_name}`,
          "commission_reconciliation",
          "Trip completed. Verify all commissions have been received from suppliers."
        );

        await createWorkflowTask(
          trip.id,
          `Send post-trip follow-up for ${trip.trip_name}`,
          "post_trip_followup",
          "Send review request and referral ask to client."
        );

        await createNotification(
          "Trip Completed",
          `"${trip.trip_name}" travel dates have passed. Commission reconciliation and follow-up tasks created.`,
          trip.id
        );

        return { allowed: true };
      }

      // === COMMISSION PENDING ===
      if (newStatus === "commission_pending") {
        await createNotification(
          "Commission Overdue",
          `Expected commission date has passed for "${trip.trip_name}". Follow up with suppliers.`,
          trip.id
        );

        await createWorkflowTask(
          trip.id,
          `Follow up on overdue commission for ${trip.trip_name}`,
          "commission_followup",
          "Expected commission date has passed. Contact suppliers to verify payment status."
        );

        return { allowed: true };
      }

      // === COMMISSION RECEIVED ===
      if (newStatus === "commission_received") {
        // Log reconciliation entry
        if (user) {
          await supabase.from("compliance_audit_log").insert({
            user_id: user.id,
            entity_type: "trip",
            entity_id: trip.id,
            event_type: "commission_reconciled",
            client_name: trip.clients?.name || null,
            metadata: { status_transition: "commission_received", trip_name: trip.trip_name },
          } as any);
        }

        await createNotification(
          "Commission Received",
          `All commissions received for "${trip.trip_name}". Trip eligible for archiving.`,
          trip.id
        );

        return { allowed: true };
      }

      // === ARCHIVED ===
      if (newStatus === "archived") {
        // Check archiving eligibility
        if (trip.status !== "commission_received" && trip.status !== "cancelled") {
          // Check if commission_received — only allow archive from there or cancelled
          const allowedArchiveFrom = ["commission_received", "cancelled", "completed", "traveled"];
          if (!allowedArchiveFrom.includes(trip.status)) {
            return {
              allowed: false,
              error: "Trip must have all commissions received (or be cancelled) before archiving",
            };
          }
        }

        // Check for open payment tasks
        const { data: openTasks } = await supabase
          .from("workflow_tasks")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("status", "pending")
          .limit(1);

        if (openTasks && openTasks.length > 0) {
          return { allowed: false, error: "Complete or dismiss all open workflow tasks before archiving" };
        }

        // Check for open CC authorizations
        const { data: openAuths } = await supabase
          .from("cc_authorizations")
          .select("id")
          .in("booking_id", bookings.map((b) => b.id))
          .in("status", ["pending", "authorized"])
          .limit(1);

        if (openAuths && openAuths.length > 0) {
          return { allowed: false, error: "All CC authorizations must be expired or completed before archiving" };
        }

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
