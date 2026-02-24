import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useAdmin";

export interface Booking {
  id: string;
  created_at: string;
  booking_type: string;
  booking_reference: string;
  destination: string;
  depart_date: string;
  return_date: string;
  travelers: number;
  total_amount: number;
  status: string;
  trip_name: string | null;
  trip_page_url: string | null;
  owner_agent: string | null;
  user_id: string;
  client_id: string;
  notes: string | null;
  // Financial fields
  supplier_id: string | null;
  gross_sales: number;
  commissionable_amount: number;
  commission_revenue: number;
  net_sales: number;
  supplier_payout: number;
  // Commission override fields
  calculated_commission: number;
  commission_override_amount: number | null;
  override_pending_approval: boolean;
  override_approved: boolean;
  override_approved_by: string | null;
  override_approved_at: string | null;
  override_notes: string | null;
  // Trip reference
  trip_id: string | null;
  // Cancellation fields
  cancelled_at: string | null;
  cancellation_penalty: number;
  cancellation_refund_amount: number;
  cancellation_reason: string | null;
  clients?: {
    name: string;
    email: string | null;
  } | null;
  trips?: {
    id: string;
    status: string;
  } | null;
}

// Helper to check if a booking should be excluded from reporting
export function isBookingArchived(booking: Booking): boolean {
  return booking.trips?.status === "archived";
}

export interface CreateBookingData {
  client_id: string;
  destination: string;
  depart_date: string;
  return_date: string;
  travelers: number;
  total_amount: number;
  trip_name?: string;
  notes?: string;
  send_confirmation_email?: boolean;
  // Financial fields
  supplier_id?: string;
  gross_sales?: number;
  commissionable_percentage?: number;
  commission_rate?: number;
  // Commission override fields
  commission_override_amount?: number;
  override_notes?: string;
}

export interface UpdateBookingData {
  destination?: string;
  depart_date?: string;
  return_date?: string;
  travelers?: number;
  total_amount?: number;
  trip_name?: string;
  notes?: string;
  // New financial fields
  supplier_id?: string | null;
  gross_sales?: number;
  commissionable_amount?: number;
  commission_revenue?: number;
  net_sales?: number;
  supplier_payout?: number;
}

export function useBookings() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);

  // Fetch agent's profile name for booking creation
  useEffect(() => {
    const fetchAgentName = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.full_name) {
        setAgentName(data.full_name);
      }
    };
    
    fetchAgentName();
  }, [user]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          created_at,
          booking_type,
          booking_reference,
          destination,
          depart_date,
          return_date,
          travelers,
          total_amount,
          status,
          trip_name,
          trip_page_url,
          owner_agent,
          user_id,
          client_id,
          notes,
          supplier_id,
          gross_sales,
          commissionable_amount,
          commission_revenue,
          net_sales,
          supplier_payout,
          calculated_commission,
          commission_override_amount,
          override_pending_approval,
          override_approved,
          override_approved_by,
          override_approved_at,
          override_notes,
          trip_id,
          cancelled_at,
          cancellation_penalty,
          cancellation_refund_amount,
          cancellation_reason,
          clients (
            name,
            email
          ),
          trips (
            id,
            status
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBookings();
    } else {
      setLoading(false);
    }
  }, [user, fetchBookings]);

  const generateBookingReference = () => {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const random = Array.from(array, b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 12);
    return `CW-${random}`;
  };

  const sendBookingConfirmationEmail = async (booking: {
    clientName: string;
    clientEmail: string;
    destination: string;
    departDate: string;
    returnDate: string;
    reference: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session for sending email");
        return false;
      }

      const response = await supabase.functions.invoke("send-email", {
        body: {
          to: booking.clientEmail,
          subject: `Booking Confirmed: ${booking.destination}`,
          template: "booking_confirmation",
          data: {
            clientName: booking.clientName,
            destination: booking.destination,
            dates: `${booking.departDate} - ${booking.returnDate}`,
            reference: booking.reference,
          },
        },
      });

      if (response.error) {
        console.error("Error sending confirmation email:", response.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending confirmation email:", error);
      return false;
    }
  };

  const sendOverrideApprovalNotification = async (overrideData: {
    agentName: string;
    bookingReference: string;
    clientName: string;
    destination: string;
    calculatedCommission: number;
    overrideAmount: number;
    overrideReason: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session for sending override notification");
        return false;
      }

      // Get admin users to notify
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError || !adminRoles?.length) {
        console.error("No admins found or error fetching admins:", rolesError);
        return false;
      }

      // Get admin profiles with emails
      const adminUserIds = adminRoles.map(r => r.user_id);
      
      // Since we can't directly get emails from auth.users, we'll use a service role approach
      // For now, we'll send to all admins we can find through the profiles table
      // In production, you might want to store admin notification emails in branding_settings
      
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("email_address")
        .single();

      const adminEmail = branding?.email_address;
      
      if (!adminEmail) {
        console.log("No admin notification email configured in branding settings");
        return false;
      }

      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(value);
      };

      const response = await supabase.functions.invoke("send-email", {
        body: {
          to: adminEmail,
          subject: `⚠️ Commission Override Requires Approval - ${overrideData.bookingReference}`,
          template: "commission_override_approval",
          data: {
            agentName: overrideData.agentName,
            bookingReference: overrideData.bookingReference,
            clientName: overrideData.clientName,
            destination: overrideData.destination,
            calculatedCommission: formatCurrency(overrideData.calculatedCommission),
            overrideAmount: formatCurrency(overrideData.overrideAmount),
            overrideReason: overrideData.overrideReason || "No reason provided",
            approvalUrl: `${window.location.origin}/commissions`,
          },
        },
      });

      if (response.error) {
        console.error("Error sending override notification:", response.error);
        return false;
      }

      console.log("Override approval notification sent to admin");
      return true;
    } catch (error) {
      console.error("Error sending override notification:", error);
      return false;
    }
  };

  const createBooking = async (data: CreateBookingData) => {
    if (!user) {
      toast.error("You must be logged in to create a booking");
      return null;
    }

    setCreating(true);
    try {
      const bookingReference = generateBookingReference();
      
      // Calculate financial fields
      const grossSales = data.gross_sales ?? data.total_amount;
      const commissionablePercentage = data.commissionable_percentage ?? 85;
      const commissionRate = data.commission_rate ?? 10;
      const commissionableAmount = grossSales * (commissionablePercentage / 100);
      const commissionRevenue = commissionableAmount * (commissionRate / 100);
      const netSales = grossSales - commissionRevenue;
      const supplierPayout = netSales;

      // Determine if override requires approval (only if override is higher than calculated)
      const hasOverride = data.commission_override_amount !== undefined && data.commission_override_amount !== null;
      const overrideAmount = hasOverride ? data.commission_override_amount : null;
      const needsApproval = hasOverride && overrideAmount! > commissionRevenue;

      const { data: newBooking, error } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
          client_id: data.client_id,
          booking_reference: bookingReference,
          destination: data.destination,
          depart_date: data.depart_date,
          return_date: data.return_date,
          travelers: data.travelers,
          total_amount: grossSales,
          trip_name: data.trip_name || null,
          notes: data.notes || null,
          status: "confirmed",
          owner_agent: agentName,
          supplier_id: data.supplier_id || null,
          gross_sales: grossSales,
          commissionable_amount: commissionableAmount,
          commission_revenue: hasOverride && !needsApproval ? overrideAmount : commissionRevenue,
          net_sales: netSales,
          supplier_payout: supplierPayout,
          calculated_commission: commissionRevenue,
          commission_override_amount: overrideAmount,
          override_pending_approval: needsApproval,
          override_approved: hasOverride && !needsApproval,
          override_notes: data.override_notes || null,
        })
        .select(`
          *,
          clients (
            name,
            email
          )
        `)
        .single();

      if (error) {
        console.error("Error creating booking:", error);
        toast.error("Failed to create booking");
        return null;
      }

      // Send confirmation email if requested and client has email
      if (data.send_confirmation_email && newBooking.clients?.email) {
        const emailSent = await sendBookingConfirmationEmail({
          clientName: newBooking.clients.name,
          clientEmail: newBooking.clients.email,
          destination: data.destination,
          departDate: data.depart_date,
          returnDate: data.return_date,
          reference: bookingReference,
        });

        if (emailSent) {
          toast.success("Booking created and confirmation email sent!");
        } else {
          toast.success("Booking created (email notification failed)");
        }
      } else {
        toast.success("Booking created successfully");
      }

      // Send admin notification if override requires approval
      if (needsApproval) {
        await sendOverrideApprovalNotification({
          agentName: agentName || "Unknown Agent",
          bookingReference,
          clientName: newBooking.clients?.name || "Unknown Client",
          destination: data.destination,
          calculatedCommission: commissionRevenue,
          overrideAmount: overrideAmount!,
          overrideReason: data.override_notes || "",
        });
        toast.info("Commission override submitted for admin approval");
      }

      // Refresh bookings list
      await fetchBookings();
      return newBooking;
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Failed to create booking");
      return null;
    } finally {
      setCreating(false);
    }
  };

  const sendTripCompletedEmail = async (booking: {
    clientName: string;
    clientEmail: string;
    destination: string;
    tripName: string | null;
    departDate: string;
    returnDate: string;
    reference: string;
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session for sending email");
        return false;
      }

      const response = await supabase.functions.invoke("send-email", {
        body: {
          to: booking.clientEmail,
          subject: `Thanks for traveling with us! - ${booking.destination}`,
          template: "trip_completed",
          data: {
            clientName: booking.clientName,
            destination: booking.destination,
            tripName: booking.tripName || booking.destination,
            dates: `${booking.departDate} - ${booking.returnDate}`,
            reference: booking.reference,
          },
        },
      });

      if (response.error) {
        console.error("Error sending trip completed email:", response.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending trip completed email:", error);
      return false;
    }
  };

  const updateBookingStatus = async (
    bookingId: string,
    newStatus: string,
    sendEmail: boolean = true
  ) => {
    if (!user) {
      toast.error("You must be logged in to update bookings");
      return false;
    }

    setUpdatingStatus(true);
    try {
      // First get the booking with client info
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        toast.error("Booking not found");
        return false;
      }

      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking status:", error);
        toast.error("Failed to update booking status");
        return false;
      }

      // Send trip completed email if status changed to completed
      if (newStatus === "completed" && sendEmail && booking.clients?.email) {
        const emailSent = await sendTripCompletedEmail({
          clientName: booking.clients.name,
          clientEmail: booking.clients.email,
          destination: booking.destination,
          tripName: booking.trip_name,
          departDate: booking.depart_date,
          returnDate: booking.return_date,
          reference: booking.booking_reference,
        });

        if (emailSent) {
          toast.success("Booking marked as completed and email sent!");
        } else {
          toast.success("Booking marked as completed (email notification failed)");
        }
      } else {
        toast.success(`Booking status updated to ${newStatus}`);
      }

      await fetchBookings();
      return true;
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Failed to update booking status");
      return false;
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateBooking = async (bookingId: string, data: UpdateBookingData) => {
    if (!user) {
      toast.error("You must be logged in to update bookings");
      return false;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          destination: data.destination,
          depart_date: data.depart_date,
          return_date: data.return_date,
          travelers: data.travelers,
          total_amount: data.total_amount,
          trip_name: data.trip_name || null,
          notes: data.notes || null,
          supplier_id: data.supplier_id,
        })
        .eq("id", bookingId);

      if (error) {
        console.error("Error updating booking:", error);
        toast.error("Failed to update booking");
        return false;
      }

      toast.success("Booking updated successfully");
      await fetchBookings();
      return true;
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Failed to update booking");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const deleteBooking = async (bookingId: string) => {
    if (!user) {
      toast.error("You must be logged in to delete bookings");
      return false;
    }

    // Check if any payments are logged against this booking
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("trip_payments")
        .select("id")
        .eq("booking_id", bookingId)
        .limit(1);

      if (paymentsError) throw paymentsError;

      if (paymentsData && paymentsData.length > 0) {
        toast.error("Cannot delete booking — payments are logged against it. Remove all payments first.");
        return false;
      }
    } catch (error) {
      console.error("Error checking booking payments:", error);
      toast.error("Failed to verify booking payments");
      return false;
    }

    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", bookingId);

      if (error) {
        console.error("Error deleting booking:", error);
        toast.error("Failed to delete booking");
        return false;
      }

      toast.success("Booking deleted successfully");
      await fetchBookings();
      return true;
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("Failed to delete booking");
      return false;
    }
  };

  return {
    bookings,
    loading,
    creating,
    updating,
    updatingStatus,
    isAdmin: !!isAdmin,
    createBooking,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    refetch: fetchBookings,
  };
}

// Extended booking type with full client data for detail page
export interface BookingWithClient extends Booking {
  updated_at?: string;
  clients: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    location: string | null;
    status: string;
  } | null;
  suppliers?: {
    id: string;
    name: string;
    commissionable_percentage: number;
    commission_rate: number;
  } | null;
}

export function useBooking(bookingId: string | undefined) {
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingWithClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!user || !bookingId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("bookings")
          .select(`
            id,
            booking_type,
            booking_reference,
            destination,
            depart_date,
            return_date,
            travelers,
            total_amount,
            status,
            trip_name,
            trip_page_url,
            owner_agent,
            user_id,
            client_id,
            notes,
            created_at,
            updated_at,
            supplier_id,
            gross_sales,
            commissionable_amount,
            commission_revenue,
            net_sales,
            supplier_payout,
            calculated_commission,
            commission_override_amount,
            override_pending_approval,
            override_approved,
            override_approved_by,
            override_approved_at,
            override_notes,
            trip_id,
            cancelled_at,
            cancellation_penalty,
            cancellation_refund_amount,
            cancellation_reason,
            clients (
              id,
              name,
              email,
              phone,
              first_name,
              last_name,
              location,
              status
            ),
            suppliers (
              id,
              name,
              commissionable_percentage,
              commission_rate
            ),
            trips (
              id,
              status
            )
          `)
          .eq("id", bookingId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setBooking(data);
      } catch (err) {
        console.error("Error fetching booking:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch booking"));
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [user, bookingId, refetchTrigger]);

  return { booking, loading, error, refetch };
}

// Hook to fetch bookings for a specific client
export function useClientBookings(clientId: string | undefined) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientBookings = async () => {
      if (!user || !clientId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("bookings")
          .select(`
            id,
            created_at,
            booking_type,
            booking_reference,
            destination,
            depart_date,
            return_date,
            travelers,
            total_amount,
            status,
            trip_name,
            trip_page_url,
            owner_agent,
            user_id,
            client_id,
            notes,
            supplier_id,
            gross_sales,
            commissionable_amount,
            commission_revenue,
            net_sales,
            supplier_payout,
            calculated_commission,
            commission_override_amount,
            override_pending_approval,
            override_approved,
            override_approved_by,
            override_approved_at,
            override_notes,
            trip_id,
            cancelled_at,
            cancellation_penalty,
            cancellation_refund_amount,
            cancellation_reason,
            trips (
              id,
              status
            )
          `)
          .eq("client_id", clientId)
          .order("depart_date", { ascending: false });

        if (error) throw error;
        setBookings(data || []);
      } catch (err) {
        console.error("Error fetching client bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientBookings();
  }, [user, clientId]);

  return { bookings, loading };
}
