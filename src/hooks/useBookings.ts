import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Booking {
  id: string;
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
  client_id: string;
  notes: string | null;
  clients?: {
    name: string;
    email: string | null;
  } | null;
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
}

export interface UpdateBookingData {
  destination?: string;
  depart_date?: string;
  return_date?: string;
  travelers?: number;
  total_amount?: number;
  trip_name?: string;
  notes?: string;
}

export function useBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBookings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
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
          client_id,
          notes,
          clients (
            name,
            email
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
  };

  const generateBookingReference = () => {
    const prefix = "CW";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
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

  const createBooking = async (data: CreateBookingData) => {
    if (!user) {
      toast.error("You must be logged in to create a booking");
      return null;
    }

    setCreating(true);
    try {
      const bookingReference = generateBookingReference();

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
          total_amount: data.total_amount,
          trip_name: data.trip_name || null,
          notes: data.notes || null,
          status: "confirmed",
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
    createBooking,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    refetch: fetchBookings,
  };
}
