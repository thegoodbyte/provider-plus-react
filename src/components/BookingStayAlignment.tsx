import React, { useState } from "react";
import { bookingsApi } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
export default function BookingStayAlignment({
  booking,
  isAdmin,
  onRefresh,
}: {
  booking: any;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (
    !isAdmin ||
    !booking.rescheduleHistory?.length ||
    booking.bookingType === "booster"
  )
    return null;
  return (
    <section
      className="mx-5 mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm"
      aria-label="Moved booking dates"
    >
      <p>
        Moved before this fix? Align arrival and departure to the current
        retreat’s dates and times. This replaces any custom full-stay dates.
        Payments and booking history remain; no email is sent.
      </p>
      <button
        type="button"
        className="mt-2 rounded border bg-white px-3 py-2"
        disabled={busy || Boolean(booking.roomId)}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await bookingsApi.repairRetreatAlignment(booking._id);
            await onRefresh();
            setMessage("Stay dates aligned to the current retreat.");
          } catch (e) {
            setMessage(
              apiErrorMessage(
                e,
                "Unable to align stay dates. Retry this action.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Aligning…" : "Align stay dates to current retreat"}
      </button>
      {booking.roomId && <p>Unassign the room before changing stay dates.</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
