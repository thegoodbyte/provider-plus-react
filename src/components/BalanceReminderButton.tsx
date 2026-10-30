import BalanceReminderHistory from "./BalanceReminderHistory";
import React, { useEffect, useState } from "react";
import { paymentsApi } from "../services/api";
import { authService } from "../services/authService";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import EmailComposeModal from "./EmailComposeModal";

export default function BalanceReminderButton({
  bookingId,
  clientName,
  disabledReason,
}: {
  bookingId: string;
  clientName?: string;
  disabledReason?: string;
}) {
  const [historyVersion, setHistoryVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(""),
    [tone, setTone] = useState("auto"),
    [language, setLanguage] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setDraft(null);
    setError("");
    paymentsApi
      .previewBalanceReminder(bookingId, {
        tone,
        ...(language ? { language } : {}),
      })
      .then(({ data }) => {
        if (current) setDraft(data);
      })
      .catch((e) => {
        if (current)
          setError(
            apiErrorMessage(e, "Could not prepare this balance reminder."),
          );
      });
    return () => {
      current = false;
    };
  }, [open, bookingId, tone, language, retry]);
  const close = () => {
    if (sending) return;
    setOpen(false);
    setDraft(null);
  };
  if (!["admin", "medical_staff"].includes(authService.getUser()?.role || ""))
    return null;
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="block rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50"
          disabled={!!disabledReason || open}
          title={disabledReason}
          aria-label={`Email client about balance${clientName ? ` — ${clientName}` : ""}`}
          onClick={() => {
            setTone("auto");
            setLanguage("");
            setOpen(true);
          }}
        >
          Email client about balance
        </button>
        <BalanceReminderHistory
          bookingId={bookingId}
          refreshKey={historyVersion}
        />
      </div>
      {open && !draft && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Email client about balance"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">
              Email client about balance
            </h2>
            {error ? (
              <>
                <p role="alert" className="my-4 text-sm text-red-800">
                  {error}
                </p>
                <button
                  type="button"
                  className="mr-3 rounded border px-3 py-2"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Retry
                </button>
              </>
            ) : (
              <p role="status" className="my-4">
                Preparing the current balance and email…
              </p>
            )}
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={close}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {open && draft && (
        <EmailComposeModal
          key={draft.balanceSnapshot}
          title="Email client about balance"
          lockTemplate
          initialValues={draft}
          onClose={close}
          onSendEmail={async (payload) => {
            setSending(true);
            try {
              return await paymentsApi.sendBalanceReminder(bookingId, {
                ...payload,
                tone: draft.tone,
                language: draft.resolvedLanguage,
                balanceSnapshot: draft.balanceSnapshot,
              });
            } finally {
              setSending(false);
              setHistoryVersion((value) => value + 1);
            }
          }}
          extraContent={
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
              <p className="mb-3">
                Current booking balance:{" "}
                <strong>
                  {draft.variables?.balanceReminder?.amountFormatted}
                </strong>
                . Review the message before sending.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Reminder wording
                  <select
                    aria-label="Reminder wording"
                    disabled={sending}
                    className="mt-1 block w-full rounded border bg-white p-2"
                    value={draft.tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    <option value="due">Payment due</option>
                    <option value="overdue">Payment overdue</option>
                  </select>
                </label>
                <label>
                  Reminder language
                  <select
                    aria-label="Reminder language"
                    disabled={sending}
                    className="mt-1 block w-full rounded border bg-white p-2"
                    value={draft.resolvedLanguage}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="cz">Čeština</option>
                    <option value="pl">Polski</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-blue-900">
                Changing wording or language resets the draft. Overdue wording
                is suggested from unpaid request dates; selecting it manually
                does not change payment status.
              </p>
            </div>
          }
        />
      )}
    </>
  );
}
