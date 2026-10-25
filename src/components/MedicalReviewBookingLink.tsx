import React, { useEffect, useRef, useState } from "react";
import { Modal } from "antd";
import { Link } from "react-router-dom";
import { medicalReviewRequestsApi } from "../services/api";
import { formatCalendarDate } from "../utils/dateFormat";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type Preview = {
  bookings: Array<{
    id: string;
    bookingNumber?: number;
    retreatName: string;
    startDate?: string;
    status: string;
  }>;
  documents: Array<{
    id: string;
    number?: number;
    title: string;
    bookingId?: string;
  }>;
  bookingId?: string;
  token?: string;
  pending?: boolean;
  canResume?: boolean;
  message?: string;
  alreadyLinked?: boolean;
};
export default function MedicalReviewBookingLink({
  requestId,
  prefix,
  onLinked,
}: {
  requestId: string;
  prefix: string;
  onLinked: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Preview | null>(null);
  const [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const refresh = async (bookingId = "") => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setData((old) => (old ? { ...old, token: undefined } : null));
    try {
      const response = await medicalReviewRequestsApi.previewBookingLink(
        requestId,
        bookingId || undefined,
      );
      if (current !== generation.current) return;
      if (
        !response.data ||
        !Array.isArray(response.data.bookings) ||
        !Array.isArray(response.data.documents) ||
        [...response.data.bookings, ...response.data.documents].some(
          (item) => !item || typeof item.id !== "string",
        )
      ) {
        throw new Error("Could not preview the booking link. Refresh and retry.");
      }
      setData(response.data);
      if (response.data.pending) setSelected(response.data.bookingId);
    } catch (err) {
      if (current === generation.current) {
        setData(null);
        setError(apiErrorMessage(err, "Could not preview the booking link."));
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [requestId]); // Each MRR owns an independent preview.
  const save = async () => {
    if (!selected || !data?.token) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await medicalReviewRequestsApi.linkBooking(
        requestId,
        selected,
        data.token,
      );
      setMessage(
        response.data.linked
          ? "Booking link saved. Review decisions and notes were preserved."
          : response.data.message ||
              "Recovery finished. Preview the link again.",
      );
      await refresh(selected);
      try {
        await onLinked();
      } catch {
        setError(
          "The link was saved, but the page could not refresh. Reload before making another change.",
        );
      }
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          "The link could not be saved. Refresh the preview and retry.",
        ),
      );
      setData((old) => (old ? { ...old, token: undefined } : old));
    } finally {
      setSaving(false);
    }
  };
  const linked = [
    ...new Set(
      (data?.documents || []).map((doc) => doc.bookingId).filter(Boolean),
    ),
  ];
  const linkedBooking = data?.bookings.find(
    (booking) => booking.id === linked[0],
  );
  const booking = data?.bookings.find((item) => item.id === selected);
  const allLinked =
    linked.length === 1 &&
    data?.documents.every((doc) => doc.bookingId === linked[0]);
  return (
    <section
      aria-label="MRR booking link"
      className="my-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <strong>Booking:</strong>
        {allLinked ? (
          <Link
            className="font-semibold text-blue-800 underline"
            to={`${prefix}/bookings/${linked[0]}`}
          >
            {linkedBooking?.bookingNumber
              ? `Booking #${linkedBooking.bookingNumber}`
              : "Linked booking"}
          </Link>
        ) : (
          <span>
            {linked.length
              ? "Documents have incomplete or mixed booking links"
              : "Not linked to a booking"}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage("");
            void refresh(selected);
          }}
          className="rounded border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-800"
        >
          Link to booking
        </button>
      </div>
      {!open && error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
      <Modal
        title="Link MRR to booking"
        open={open}
        footer={null}
        width={720}
        maskClosable={!saving}
        closable={!saving}
        onCancel={() => setOpen(false)}
      >
        <p className="mb-3">
          Link the documents below to the selected booking. Existing review
          decisions and notes are preserved. No messages are sent and booking
          requirements are not automatically approved.
        </p>
        {data?.pending && (
          <p role="status" className="mb-3 rounded bg-amber-50 p-3">
            {data.message}
          </p>
        )}
        <label className="block font-semibold">
          Client booking
          <select
            value={selected}
            disabled={saving || data?.pending}
            onChange={(event) => {
              setSelected(event.target.value);
              setMessage("");
              void refresh(event.target.value);
            }}
            className="mt-1 w-full rounded border p-2"
          >
            <option value="">Select a booking</option>
            {data?.bookings.map((item) => (
              <option key={item.id} value={item.id}>
                Booking #{item.bookingNumber || "—"} · {item.retreatName} ·{" "}
                {formatCalendarDate(item.startDate) || "Date not set"} ·{" "}
                {item.status}
              </option>
            ))}
            {data?.pending && !booking && (
              <option value={data.bookingId}>
                Previously selected booking — recovery
              </option>
            )}
          </select>
        </label>
        {data && !data.bookings.length && !data.pending && (
          <p className="mt-2 text-amber-800">
            No eligible bookings for this client. Create their booking first.
          </p>
        )}
        <h3 className="mt-4 font-bold">Documents affected</h3>
        {!data?.documents.length && (
          <p className="mt-2">
            No linked medical documents. Attach the source documents to the MRR
            first.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {data?.documents.map((doc) => (
            <li key={doc.id} className="rounded border p-3">
              <strong>
                #{doc.number || "—"} · {doc.title}
              </strong>
              <p className="text-sm text-gray-600">
                {doc.bookingId
                  ? doc.bookingId === selected
                    ? "Already linked to the selected booking"
                    : "Already linked to a booking; reassignment is blocked here"
                  : "Client-only document — will be linked when confirmed"}
              </p>
            </li>
          ))}
        </ul>
        {booking && data?.token && !loading && (
          <p className="mt-3 rounded bg-blue-50 p-3">
            Confirm linking these documents to{" "}
            <strong>
              Booking #{booking.bookingNumber || "—"} · {booking.retreatName}
            </strong>
            .
          </p>
        )}
        {loading && (
          <p role="status" className="mt-3">
            Checking booking and document links…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-green-800">
            {message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void refresh(selected)}
            className="rounded border px-4 py-2"
          >
            Refresh preview
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen(false)}
            className="rounded border px-4 py-2"
          >
            Close
          </button>
          <button
            type="button"
            disabled={
              saving ||
              loading ||
              !data?.token ||
              !data.documents.length ||
              (data.pending && !data.canResume) ||
              !selected
            }
            onClick={() => void save()}
            className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving link…"
              : data?.pending
                ? "Resume link"
                : data?.alreadyLinked
                  ? "Confirm existing link"
                  : "Confirm booking link"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
