/** Supplier settlement never infers a booking from a trip's first booking. */
export async function resolveSupplierBooking(db: any, record: any) {
  if (!record?.id) return null;
  const { data: booking, error: bookingError } = await db.from("bookings")
    .select("*").eq("id", record.id).maybeSingle();
  if (bookingError) throw bookingError;
  if (booking) return booking;
  const { data: payment, error: paymentError } = await db.from("trip_payments")
    .select("booking_id, trip_id").eq("id", record.id).maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment?.booking_id) return null;
  const { data: linked, error: linkedError } = await db.from("bookings")
    .select("*").eq("id", payment.booking_id).maybeSingle();
  if (linkedError) throw linkedError;
  return linked && linked.trip_id === payment.trip_id ? linked : null;
}