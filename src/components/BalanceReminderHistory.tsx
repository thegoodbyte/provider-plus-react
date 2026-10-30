import React, { useEffect, useState } from "react";
import { Popover } from "antd";
import { Mail, RefreshCw, X } from "lucide-react";
import { communicationsApi } from "../services/api";

const recordId = (v: any) => String(v?._id || v || "");
const sentToClient = (r: any) =>
  r.status === "sent" &&
  !r.safetyRedirected &&
  r.provider !== "development_capture";
const deliveryLabel = (r: any) =>
  r.safetyRedirected
    ? "Redirected to safety inbox"
    : r.provider === "development_capture"
      ? "Development capture"
      : r.status === "sent"
        ? "Sent to client"
        : r.status === "queued"
          ? "Queued / unconfirmed"
          : r.status === "failed"
            ? "Failed / unconfirmed"
            : "Not sent";
const recipients = (value: any) =>
  Array.isArray(value) ? value.join(", ") : String(value || "Unavailable");
const timeLabel = (value: any) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Time unavailable";
};
const languageLabel = (row: any) => {
  const language = String(
    row.variablesSnapshot?.client?.language || row.templateId?.language || "",
  ).toLowerCase();
  return (
    (
      { en: "English", cz: "Čeština", cs: "Čeština", pl: "Polski" } as Record<
        string,
        string
      >
    )[language] || "Language unavailable"
  );
};
export default function BalanceReminderHistory({
  bookingId,
  refreshKey = 0,
}: {
  bookingId: string;
  refreshKey?: number;
}) {
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false),
    [revision, setRevision] = useState(0),
    [items, setItems] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems([]);
    setLoading(true);
    setError("");
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      setLoading(false);
      setError("Reminder history is unavailable for this booking.");
      return;
    }
    communicationsApi
      .getSentEmails(
        { bookingId, relatedEntityType: "booking_balance_reminder" },
        { suppressGlobalError: true },
      )
      .then(({ data }) => {
        if (!active) return;
        if (!Array.isArray(data)) throw Error("Invalid history");
        setItems(
          data
            .filter(
              (r: any) =>
                r &&
                r.relatedEntityType === "booking_balance_reminder" &&
                (recordId(r.bookingId).toLowerCase() ===
                  bookingId.toLowerCase() ||
                  String(r.relatedEntityId || "").toLowerCase() ===
                    bookingId.toLowerCase()),
            )
            .sort(
              (a: any, b: any) =>
                new Date(b.sentAt || b.createdAt || 0).getTime() -
                new Date(a.sentAt || a.createdAt || 0).getTime(),
            ),
        );
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load reminder history. The sent count is unknown.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookingId, refreshKey, revision]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const count = items.filter(sentToClient).length;
  const content = (
    <section
      role="region"
      aria-label="Balance reminder history"
      style={{ width: 360, maxWidth: "calc(100vw - 48px)" }}
      className="whitespace-normal text-sm text-slate-800"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <strong>Balance reminder history</strong>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Refresh reminder history"
            disabled={loading}
            className="rounded p-2 hover:bg-slate-100"
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            aria-label="Close reminder history"
            className="rounded p-2 hover:bg-slate-100"
            onClick={() => {
              setPinned(false);
              setOpen(false);
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      {loading ? (
        <p role="status">Loading reminder history…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry history
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-600">
            {count} confirmed sent · {items.length} recorded{" "}
            {items.length === 1 ? "attempt" : "attempts"}. Sent does not confirm
            the email was opened.
          </p>
          {!items.length ? (
            <p>No balance reminders recorded yet.</p>
          ) : (
            <ol
              className="space-y-3 overflow-y-auto pr-1"
              style={{ maxHeight: "min(60vh, 420px)" }}
            >
              {items.map((r) => (
                <li
                  key={r._id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>
                      {r.display_id ? `#${r.display_id}` : "Reminder"}
                    </strong>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${sentToClient(r) ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
                    >
                      {deliveryLabel(r)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs">
                    {r.sentAt ? "Sent / processed" : "Recorded"}:{" "}
                    {timeLabel(r.sentAt || r.createdAt)}
                  </p>
                  <p className="mt-1 break-words text-xs">
                    To: {recipients(r.to)}
                  </p>
                  {r.safetyRedirected && r.intendedRecipients?.to && (
                    <p className="text-xs">
                      Intended client: {recipients(r.intendedRecipients.to)}
                    </p>
                  )}
                  <p className="mt-1 text-xs">
                    {languageLabel(r)}
                    {r.variablesSnapshot?.balanceReminder?.tone
                      ? " · " +
                        (r.variablesSnapshot.balanceReminder.tone === "overdue"
                          ? "Overdue"
                          : "Due")
                      : ""}
                  </p>
                  {r.variablesSnapshot?.balanceReminder?.amountFormatted && (
                    <p className="mt-1 text-xs">
                      Balance in message:{" "}
                      {r.variablesSnapshot.balanceReminder.amountFormatted}
                    </p>
                  )}
                  {r.createdBy && (
                    <p className="mt-1 break-words text-xs">
                      Sent by: {r.createdBy}
                    </p>
                  )}
                  <p className="mt-2 break-words font-semibold">
                    {r.subject || "No subject"}
                  </p>
                  {r.errorMessage && (
                    <p className="mt-1 break-words text-xs text-red-800">
                      {r.errorMessage}
                    </p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-blue-800 underline">
                      View message
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs">
                      {r.bodyText || "Message text unavailable."}
                    </pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
  return (
    <Popover
      content={content}
      trigger={["hover", "focus"]}
      placement="bottomRight"
      open={open}
      onOpenChange={(next) => {
        if (!next && pinned) return;
        setOpen(next);
        if (next && !open) setRevision((v) => v + 1);
      }}
      destroyOnHidden
    >
      <button
        type="button"
        onClick={() => {
          setPinned(true);
          setOpen(true);
        }}
        aria-expanded={open}
        aria-label={
          loading
            ? "Balance reminder history: loading"
            : error
              ? "Balance reminder history: unavailable"
              : `Balance reminder history: ${count} sent`
        }
        className={`inline-flex min-w-12 items-center justify-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-semibold ${!error && count > 0 ? "border-green-200 bg-green-50 text-green-800" : error || (!loading && items.length > 0) ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-300 bg-white text-slate-700"}`}
      >
        <Mail size={14} aria-hidden="true" />
        <span>{loading ? "…" : error ? "?" : count}</span>
      </button>
    </Popover>
  );
}
