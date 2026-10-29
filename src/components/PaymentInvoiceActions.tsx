import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentRequestsApi, serviceRequestsApi } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { getPreferredPaymentUrl } from "./paymentRequestLinks";
import PaymentRequestInvoicePreview from "./PaymentRequestInvoicePreview";
import EmailComposeModal from "./EmailComposeModal";
const id = (value: any) => String(value?._id || value || "");
export default function PaymentInvoiceActions({
  requestId,
  clientId,
  onRequestLoaded,
}: {
  requestId: string;
  clientId: string;
  onRequestLoaded?: (request: any) => void;
}) {
  const [result, setResult] = useState<{
      id: string;
      request?: any;
      error?: string;
    }>({ id: "" }),
    [retry, setRetry] = useState(0),
    [compose, setCompose] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!requestId) return;
    let active = true;
    setResult({ id: "" });
    setCompose(false);
    setNotice("");
    paymentRequestsApi
      .getOneFresh(requestId, { suppressGlobalError: true })
      .then(async ({ data }) =>
        data.context === "standalone_service"
          ? (await serviceRequestsApi.get(requestId)).data
          : data,
      )
      .then((request) => {
        if (active) {
          setResult({ id: requestId, request });
          onRequestLoaded?.(request);
        }
      })
      .catch((error) => {
        if (active)
          setResult({
            id: requestId,
            error: apiErrorMessage(error, "Unable to load the linked invoice."),
          });
      });
    return () => {
      active = false;
    };
  }, [requestId, retry, onRequestLoaded]);
  if (!requestId)
    return (
      <p className="mt-4 text-sm text-gray-600">
        Link a payment request to this payment to view or share its online
        invoice.
      </p>
    );
  const current = result.id === requestId,
    request = current ? result.request : null;
  const mismatch = request && id(request.clientId) !== clientId;
  const available =
    request &&
    !mismatch &&
    request.status !== "cancelled" &&
    !request.publicLinkRevokedAt &&
    Boolean(request.publicHash);
  const url = available ? getPreferredPaymentUrl(request) : "";
  const client = typeof request?.clientId === "object" ? request.clientId : {};
  return (
    <section
      aria-label="Linked online invoice"
      className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4"
    >
      <h2 className="font-semibold text-gray-900">Online invoice</h2>
      <Link
        to={`/admin/payment-requests/${encodeURIComponent(requestId)}`}
        className="mt-2 inline-block text-blue-700 underline"
      >
        Open linked payment request
      </Link>
      {!current && <p role="status">Loading invoice link…</p>}
      {current && result.error && (
        <div role="alert">
          <p>{result.error}</p>
          <button
            type="button"
            className="mt-2 rounded border bg-white px-3 py-2"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry invoice link
          </button>
        </div>
      )}
      {request && (
        <>
          {mismatch && (
            <p role="alert" className="mt-2 text-amber-900">
              The linked invoice belongs to another client. Review the payment
              request before sharing.
            </p>
          )}
          {!available && !mismatch && (
            <p className="mt-2 text-sm text-gray-700">
              {request.status === "cancelled" || request.publicLinkRevokedAt
                ? "The private invoice link is inactive. Review the payment request before sharing."
                : "No private invoice link is available yet. Open the payment request to review it."}
            </p>
          )}
          {available && (
            <>
              <p className="mt-2 text-sm text-gray-700">
                Copy this private client link or review an email before sending
                it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border bg-white px-3 py-2 text-blue-700"
                >
                  Open online invoice
                </a>
                <button
                  type="button"
                  className="rounded border bg-white px-3 py-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setNotice("Private invoice link copied.");
                    } catch {
                      setNotice(
                        "Clipboard unavailable. Copy the link from the field below.",
                      );
                    }
                  }}
                >
                  Copy invoice link
                </button>
                <button
                  type="button"
                  disabled={!client.email}
                  className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50"
                  onClick={() => setCompose(true)}
                >
                  Email invoice link
                </button>
              </div>
              <label className="mt-3 block text-sm">
                Private invoice link
                <input
                  readOnly
                  value={url}
                  className="mt-1 w-full rounded border bg-white px-3 py-2"
                  onFocus={(e) => e.target.select()}
                />
              </label>
              {!client.email && (
                <p className="mt-2 text-sm">
                  No client email is available. Copy the link to share it
                  manually.
                </p>
              )}
            </>
          )}
          {request.context !== "standalone_service" && (
            <div className="mt-3">
              <PaymentRequestInvoicePreview
                key={requestId}
                requestId={requestId}
              />
            </div>
          )}
          {compose && available && (
            <EmailComposeModal
              title="Email invoice link"
              initialValues={{
                to: client.email,
                subject: `Invoice ${request.invoiceNumber || request.display_id || ""}`,
                bodyText: `Hello ${client.firstName || "there"},\n\nYou can view your invoice online here:\n${url}\n\nIboga Spirit`,
                clientId: id(request.clientId),
                retreatId: id(request.retreatId) || undefined,
                relatedEntityType: "payment_request",
                relatedEntityId: requestId,
              }}
              onClose={() => setCompose(false)}
              onSent={() => {
                setCompose(false);
                setNotice("Invoice link sent.");
              }}
            />
          )}
        </>
      )}
      {notice && (
        <p role="status" className="mt-2">
          {notice}
        </p>
      )}
    </section>
  );
}
