import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { paymentRequestsApi, paymentsApi } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import ExistingPaymentPicker, {
  emptyPaymentSearch,
} from "./ExistingPaymentPicker";
export default function RequestExistingPayment({
  request,
  onClose,
  onLinked,
}: {
  request: any;
  onClose: () => void;
  onLinked: () => Promise<void>;
}) {
  const [filters, setFilters] = useState(emptyPaymentSearch),
    [data, setData] = useState<any>({ payments: [] }),
    [selected, setSelected] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await paymentRequestsApi.existingPayments(
          request._id,
          filters,
        );
        if (active) setData(response.data);
      } catch (e) {
        if (active) {
          setData({ payments: [] });
          setError(apiErrorMessage(e, "Unable to load existing payments."));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [request._id, filters, attempt]);
  const link = async () => {
    if (busy || !selected || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      await paymentsApi.linkRequest(selected._id, request._id);
      setSaved(true);
      try {
        await onLinked();
        onClose();
      } catch {
        setError(
          "Payment linked, but the request list could not refresh. Close and reload before linking anything else.",
        );
      }
    } catch (e: any) {
      if (e?.response?.status === 503 || !e?.response) {
        setError(
          "The link could not finish refreshing. Retry this same link; do not record another payment. Your selection is retained.",
        );
      } else
        setError(
          apiErrorMessage(
            e,
            "Unable to finish the link. Your selection is retained; retry this same payment.",
          ),
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Link existing payment to request #${request.invoiceNumber || request.display_id}`}
      open
      onCancel={() => {
        if (!busy) onClose();
      }}
      footer={null}
      width={760}
      maskClosable={!busy}
      closable={!busy}
      keyboard={!busy}
      styles={{
        body: {
          maxHeight: "75dvh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        },
      }}
    >
      <div className="space-y-4">
        <p>
          Choose money already recorded for this client in {request.currency}.
          Linking updates the request’s received total and any related booking.
          It does not create a payment or send email. Partial payments remain
          partial.
        </p>
        <fieldset disabled={busy || saved} className="space-y-3">
          <ExistingPaymentPicker
            filters={filters}
            onFilters={(changes) => {
              setFilters((v) => ({
                ...v,
                ...changes,
                page: changes.page || 1,
              }));
              setSelected(null);
              setConfirmed(false);
            }}
            data={data}
            loading={loading}
            error={loading ? "" : error && !selected ? error : ""}
            onRetry={() => setAttempt((v) => v + 1)}
            selectedId={selected?._id || ""}
            onSelect={(p) => {
              setSelected(p);
              setConfirmed(false);
              setError("");
            }}
            help="Only this client’s completed payments in the request currency are shown, even with Match any. Payments recorded from scratchpad are included. Amount and dates are optional; the paid amount need not equal the full invoice."
          />
          {selected && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p>
                Link payment #{selected.display_id || selected._id}:{" "}
                {selected.amount} {selected.currency} ·{" "}
                {String(selected.paymentDate || "").slice(0, 10)} to request #
                {request.invoiceNumber || request.display_id}?
              </p>
              <label className="mt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I checked the client, transaction and booking and confirm this
                payment belongs to this request.
              </label>
            </div>
          )}
        </fieldset>
        {error && selected && (
          <p role="alert" className="text-red-800">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            className="rounded border px-3 py-2"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-40"
            disabled={busy || saved || loading || !selected || !confirmed}
            onClick={link}
          >
            {busy ? "Linking…" : "Confirm existing payment link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
