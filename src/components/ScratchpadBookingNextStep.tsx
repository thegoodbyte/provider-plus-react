import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentRequestsApi, ScratchpadReceipt } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import RequestBookingAction from "./RequestBookingAction";
const id = (value: any) => String(value?._id || value || "");
export default function ScratchpadBookingNextStep({
  receipt,
}: {
  receipt: ScratchpadReceipt;
}) {
  const requestId =
    id(receipt.payment?.paymentRequestId) ||
    receipt.matchedPaymentRequestId ||
    "";
  const bookingId = id(receipt.payment?.bookingId);
  const [request, setRequest] = useState<any>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRequest(null);
    setError("");
    if (
      !requestId ||
      bookingId ||
      receipt.paymentMissing ||
      receipt.reconciliationPending
    )
      return;
    (async () => {
      try {
        const { data } = await paymentRequestsApi.getOneFresh(requestId);
        if (active) setRequest(data);
      } catch (e) {
        if (active)
          setError(
            apiErrorMessage(
              e,
              "Could not load the request. Retry before creating a booking.",
            ),
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [
    requestId,
    bookingId,
    receipt.paymentMissing,
    receipt.reconciliationPending,
    attempt,
  ]);
  if (receipt.paymentMissing || receipt.reconciliationPending) return null;
  return (
    <section
      aria-label="Next booking step"
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">
        Payment recorded — next, the booking
      </h2>
      <p className="my-2 text-sm">
        The payment is already recorded. Create or link the booking using this
        request; do not enter the same payment again. A paid deposit does not
        mean the full booking is paid.
      </p>
      {receipt.paymentId && (
        <Link
          className="mb-3 inline-block text-blue-700 underline"
          to={`/admin/payments/${receipt.paymentId}`}
        >
          View recorded payment
        </Link>
      )}
      {bookingId ? (
        <Link
          className="block font-semibold text-blue-700 underline"
          to={`/admin/bookings/${encodeURIComponent(bookingId)}`}
        >
          Open booking
        </Link>
      ) : !requestId ? (
        <p className="text-sm">
          No payment request is linked.{" "}
          <Link
            className="text-blue-700 underline"
            to={`/admin/payments/${receipt.paymentId}`}
          >
            Open the payment
          </Link>{" "}
          to link its request or booking.
        </p>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button
            className="underline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry booking step
          </button>
        </p>
      ) : request ? (
        <>
          <Link
            className="mb-3 block text-blue-700 underline"
            to={`/admin/payment-requests/${encodeURIComponent(requestId)}`}
          >
            View payment request #{request.invoiceNumber || request.display_id}
          </Link>
          <RequestBookingAction request={request} />
        </>
      ) : (
        <p role="status">Loading booking step…</p>
      )}
    </section>
  );
}
