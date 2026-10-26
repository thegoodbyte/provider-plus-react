import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { paymentRequestsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCalendarDate } from "../utils/dateFormat";

export default function PaymentRequestInvoicePreview({
  requestId,
}: {
  requestId: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    invoice?: any;
    error?: string;
    loading: boolean;
  }>({ loading: false });
  const allowed = user?.role === "admin";
  useEffect(() => {
    if (!open || !allowed) return;
    let active = true;
    setState({ loading: true });
    paymentRequestsApi
      .previewInvoice(requestId)
      .then((response) => {
        if (!response.data?.previewOnly || !response.data?.invoice)
          throw Error("Invalid invoice preview response.");
        if (active)
          setState({ invoice: response.data.invoice, loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            loading: false,
            error: apiErrorMessage(
              error,
              "Could not load the invoice preview.",
            ),
          });
      });
    return () => {
      active = false;
    };
  }, [open, allowed, requestId, retry]);
  if (!allowed) return null;
  const invoice = state.invoice;
  const money = (amount: any) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(invoice?.currency || "")
        ? invoice.currency
        : "EUR",
    }).format(Number(amount ?? 0));
  const date = (value: string) => (value ? formatCalendarDate(value) : "—");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Preview online invoice (admin)
      </button>
      <Modal
        title="Admin invoice preview"
        open={open}
        width={850}
        footer={null}
        onCancel={() => setOpen(false)}
      >
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          Read-only preview. The client form is skipped here; no consent is
          recorded and this does not count as a client visit.
        </p>
        {state.loading && <p role="status">Loading invoice…</p>}
        {state.error && (
          <div role="alert">
            <p>{state.error}</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="mt-2 rounded border px-3 py-2"
            >
              Retry invoice preview
            </button>
          </div>
        )}
        {!state.loading && invoice && (
          <article
            aria-label="Invoice preview"
            className="space-y-5 break-words rounded-lg border p-4 sm:p-6"
          >
            <header>
              <p className="text-sm text-gray-600">ISCZ · Payment request</p>
              <h2 className="text-2xl font-semibold">
                Invoice #{invoice.invoiceNumber}
              </h2>
              <p className="capitalize">
                {String(invoice.status || "pending").replace(/_/g, " ")}
              </p>
            </header>
            {invoice.status === "cancelled" && (
              <p
                role="status"
                className="rounded border border-red-200 bg-red-50 p-3"
              >
                Cancelled invoice. {invoice.cancellationReason || ""} Payment is
                unavailable.
              </p>
            )}
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Client</dt>
                <dd className="font-semibold">{invoice.clientName || "—"}</dd>
                <dd>{invoice.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Invoice date</dt>
                <dd>{date(invoice.paymentRequestDate)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Retreat</dt>
                <dd>{invoice.retreatName || "—"}</dd>
                <dd>{invoice.retreatCode}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Retreat dates</dt>
                <dd>
                  {date(invoice.retreatStartDate)} –{" "}
                  {date(invoice.retreatEndDate)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Location</dt>
                <dd>{invoice.retreatHouseName}</dd>
                <dd>{invoice.retreatAddress || invoice.retreatTown || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Accommodation</dt>
                <dd>{invoice.accommodationLabel || invoice.roomType || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Total price</dt>
                <dd className="font-semibold">{money(invoice.totalPrice)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">
                  Requested amount ·{" "}
                  {String(invoice.requestType || "").replace(/_/g, " ")}
                </dt>
                <dd className="text-xl font-semibold">
                  {money(invoice.depositAmount)}
                </dd>
              </div>
            </dl>
            {invoice.lineItems?.length > 0 && (
              <section aria-label="Invoice items">
                <h3 className="font-semibold">Invoice items</h3>
                <ul className="divide-y">
                  {invoice.lineItems.map((item: any, index: number) => (
                    <li
                      key={index}
                      className="flex flex-wrap justify-between gap-2 py-3"
                    >
                      <div>
                        <p>{item.description || item.type || "Item"}</p>
                        <p className="text-sm text-gray-600">
                          {[item.clientName, item.bookingLabel]
                            .filter(Boolean)
                            .join(" · ")}
                          {item.quantity != null
                            ? ` · ${item.quantity} × ${money(item.unitPrice)}`
                            : ""}
                        </p>
                      </div>
                      <strong>{money(item.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {invoice.notes && (
              <section>
                <h3 className="font-semibold">Notes</h3>
                <p className="whitespace-pre-wrap">{invoice.notes}</p>
              </section>
            )}
            {invoice.paymentInstructions && (
              <section>
                <h3 className="font-semibold">Payment instructions</h3>
                <p className="whitespace-pre-wrap">
                  {invoice.paymentInstructions}
                </p>
              </section>
            )}
            <p className="border-t pt-3 text-sm text-gray-600">
              Client consent:{" "}
              {invoice.depositConsent?.acceptedAt
                ? `recorded ${date(invoice.depositConsent.acceptedAt)}`
                : "not recorded"}
              . This preview does not accept terms or initiate a payment.
            </p>
          </article>
        )}
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border px-4 py-2"
          >
            Close preview
          </button>
        </div>
      </Modal>
    </>
  );
}
