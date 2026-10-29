import React, { useEffect, useRef, useState } from "react";
import { Modal } from "antd";
import { paymentRequestsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
export const PREVIEW_READY = "isc-invoice-preview:ready",
  PREVIEW_DATA = "isc-invoice-preview:data";
export const clientPreviewUrl = () =>
  process.env.REACT_APP_CLIENT_INVOICE_PREVIEW_URL ||
  "https://ibogaspirit.pl/clients/payment/admin-preview";
const languageFor = (value: any) => {
  const language = String(value || "en")
    .toLowerCase()
    .split("-")[0];
  return ["cs", "cz"].includes(language)
    ? "cz"
    : ["pl", "en", "de", "ru"].includes(language)
      ? language
      : "en";
};
export default function PaymentRequestInvoicePreview({
  requestId,
}: {
  requestId: string;
}) {
  const { user } = useAuth(),
    allowed = user?.role === "admin",
    frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false),
    [retry, setRetry] = useState(0),
    [invoice, setInvoice] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [ready, setReady] = useState(false),
    [language, setLanguage] = useState("en"),
    [mobile, setMobile] = useState(false),
    [frameError, setFrameError] = useState(false);
  const url = clientPreviewUrl(),
    origin = new URL(url).origin;
  useEffect(() => {
    if (!open || !allowed) return;
    let active = true;
    setInvoice(null);
    setError("");
    setLoading(true);
    setReady(false);
    setFrameError(false);
    paymentRequestsApi
      .previewInvoice(requestId)
      .then((response) => {
        if (!response.data?.previewOnly || !response.data?.invoice)
          throw Error("Invalid invoice preview response.");
        if (active) {
          setInvoice(response.data.invoice);
          setLanguage(languageFor(response.data.invoice.language));
        }
      })
      .catch((failure) => {
        if (active)
          setError(apiErrorMessage(failure, "Unable to load invoice preview."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, allowed, requestId, retry]);
  useEffect(() => {
    if (!open || !allowed) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin === origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === PREVIEW_READY
      ) {
        setReady(true);
        setFrameError(false);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [open, allowed, origin]);
  useEffect(() => {
    if (open && allowed && ready && invoice)
      frame.current?.contentWindow?.postMessage(
        {
          type: PREVIEW_DATA,
          previewOnly: true,
          invoice: { ...invoice, language },
        },
        origin,
      );
  }, [open, allowed, ready, invoice, language, origin]);
  useEffect(() => {
    if (!open || !invoice || ready) return;
    const timeout = window.setTimeout(() => setFrameError(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [open, invoice, ready, retry]);
  if (!allowed) return null;
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
        title="Client website invoice preview"
        open={open}
        width={1200}
        footer={null}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          The actual client website layout, after the form. Read-only: no
          consent, payment or client visit is recorded. Payment links and form
          actions are disabled.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label>
            Preview language{" "}
            <select
              aria-label="Preview language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded border px-3 py-2"
            >
              {[
                ["en", "English"],
                ["pl", "Polski"],
                ["cz", "Čeština"],
                ["de", "Deutsch"],
                ["ru", "Русский"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
            className="rounded border px-3 py-2"
          >
            Desktop view
          </button>
          <button
            type="button"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
            className="rounded border px-3 py-2"
          >
            Mobile view
          </button>
        </div>
        {loading && <p role="status">Loading invoice…</p>}
        {(error || frameError) && (
          <div role="alert">
            <p>
              {error ||
                "The client-page preview could not connect. Its website update may still be awaiting deployment."}
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="mt-2 rounded border px-3 py-2"
            >
              Retry invoice preview
            </button>
          </div>
        )}
        {invoice && !error && (
          <p className="mb-2 text-sm text-gray-600">
            Request status: {invoice.status || "pending"}
          </p>
        )}
        {invoice && !error && (
          <div
            style={{
              width: mobile ? 390 : "100%",
              maxWidth: "100%",
              margin: "0 auto",
            }}
          >
            <iframe
              key={`${requestId}:${retry}`}
              ref={frame}
              src={url}
              title="Actual client invoice page"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="h-[72vh] w-full rounded border border-gray-300 bg-white"
            />
          </div>
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
