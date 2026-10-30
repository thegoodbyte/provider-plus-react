import { Modal } from "antd";
import { useInvoiceDraft } from "./useInvoiceDraft";
import { BillingPartyFields, emptyBillingParty } from "./BillingPartyFields";
import { API_BASE_URL } from "../config/api.config";
import InvoiceVisitHistory from "./InvoiceVisitHistory";
import { useToast } from "../hooks/useToast";
import Toast from "./Toast";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { clientsApi, serviceRequestsApi } from "../services/api";
import { getServicePaymentUrl } from "./paymentRequestLinks";
import "./ServicePaymentRequestPage.css";
import EmailComposeModal from "./EmailComposeModal";
import SearchableClientSelect from "./SearchableClientSelect";
const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).format(
    n || 0,
  );
const errorText = (e: any) =>
  apiErrorMessage(e, "Could not save this payment request.");
export default function ServicePaymentRequestPage() {
  const { toast, showError, dismiss } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null),
    [clients, setClients] = useState<any[]>([]),
    [request, setRequest] = useState<any>(null);
  const [clientId, setClient] = useState(""),
    [title, setTitle] = useState("Service payment request"),
    [currency, setCurrency] = useState("EUR"),
    [policyCode, setPolicy] = useState(""),
    [dueDate, setDue] = useState("");
  const [recipientMode, setRecipientMode] = useState("client");
  const [billingRecipient, setBillingRecipient] =
    useState<any>(emptyBillingParty);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const location = useLocation();
  const initialClient = new URLSearchParams(location.search).get("clientId");
  useEffect(() => {
    if (initialClient) setClient(initialClient);
  }, [initialClient]);
  const [items, setItems] = useState<any[]>([]),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false),
    [language, setLanguage] = useState("en"),
    [overrideMethods, setOverrideMethods] = useState(false),
    [methods, setMethods] = useState<any>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      serviceRequestsApi.settings(),
      clientsApi.getBookingOptions(),
      ...(id ? [serviceRequestsApi.get(id)] : []),
    ])
      .then(([s, c, r]) => {
        if (!live) return;
        setSettings(s.data.configuration);
        setMethods(s.data.configuration.paymentMethods);
        setClients(c.data);
        setPolicy(s.data.configuration.policies[0]?.code || "");
        if (r) {
          setRequest(r.data);
          setBillingRecipient(
            r.data.serviceDocument?.billingRecipient ||
              r.data.serviceDocument?.client ||
              emptyBillingParty,
          );
        }
      })
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [id]);
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [currencyUndo, setCurrencyUndo] = useState<any>(null);
  const applyDraft = useCallback((p: any) => {
    setClient(p.clientId || "");
    setTitle(p.title ?? "Service payment request");
    setCurrency(p.currency || "EUR");
    setPolicy(p.policyCode || "");
    setDue(p.dueDate || "");
    setRecipientMode(p.recipientMode || "client");
    setBillingRecipient(p.billingRecipient || emptyBillingParty);
    setItems(
      (p.items || []).map((row: any) => ({
        ...row,
        type: row.type || "charge",
        description: row.description || "",
        quantity: row.quantity ?? "",
        unitPrice: row.unitPrice ?? "",
      })),
    );
    setLanguage(p.language || "en");
    setOverrideMethods(Boolean(p.overrideMethods));
    setMethods(p.methods || null);
    setPreview(false);
    setCurrencyUndo(null);
  }, []);
  const emptyDraft = useCallback(
    () => ({
      clientId: initialClient || "",
      title: "Service payment request",
      currency: "EUR",
      policyCode: settings?.policies[0]?.code || "",
      dueDate: "",
      recipientMode: "client",
      billingRecipient: emptyBillingParty,
      items: [],
      language: "en",
      overrideMethods: false,
      methods: settings?.paymentMethods || null,
    }),
    [settings, initialClient],
  );
  const draft = useInvoiceDraft({
    enabled: !id && Boolean(settings),
    payload: {
      clientId,
      title,
      currency,
      policyCode,
      dueDate,
      recipientMode,
      billingRecipient,
      items,
      language,
      overrideMethods,
      methods,
    },
    apply: applyDraft,
    empty: emptyDraft,
    initialClient,
    onIssued: (requestId) =>
      navigate(`/admin/payment-requests/services/${requestId}`),
  });
  const draftAction = async (action: () => Promise<any>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const editItem = (index: number, key: string, value: any) => {
    setPreview(false);
    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  };
  const total =
    Math.round(
      items.reduce(
        (sum, item) =>
          sum +
          (item.type === "discount" ? -1 : 1) *
            Math.round(Number(item.unitPrice) * 100) *
            (item.type === "discount" ? 1 : Number(item.quantity)),
        0,
      ),
    ) / 100;
  const valid =
    (recipientMode === "client"
      ? clientId
      : billingRecipient.name.trim() && billingRecipient.email.trim()) &&
    items.length > 0 &&
    items.every(
      (i) =>
        i.description.trim() &&
        Number.isFinite(Number(i.unitPrice)) &&
        Number(i.unitPrice) > 0 &&
        Number.isInteger(Number(i.quantity)) &&
        Number(i.quantity) > 0,
    ) &&
    total > 0;
  const selectedPolicy = settings?.policies.find(
    (p: any) => p.code === policyCode,
  );
  const issue = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await draft.issue();
      navigate(`/admin/payment-requests/services/${response.data._id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const invoiceUrl = request?.publicHash
    ? `${API_BASE_URL}/public/service-payment-requests/${request.publicHash}/invoice.pdf`
    : "";
  const invoiceAction = async (download: boolean | "preview" = false) => {
    setInvoiceBusy(true);
    setError("");
    try {
      if (download) {
        const response =
          download === "preview"
            ? await serviceRequestsApi.previewInvoice(id!, { billingRecipient })
            : await serviceRequestsApi.invoicePdf(id!);
        const url = URL.createObjectURL(response.data);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          download === "preview"
            ? "invoice-preview.pdf"
            : `invoice-${request.invoiceDocument.number}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        await serviceRequestsApi.issueInvoice(id!, { billingRecipient });
        setRequest((await serviceRequestsApi.get(id!)).data);
        setNotice("Invoice issued. No payment was recorded and no email sent.");
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setInvoiceBusy(false);
    }
  };
  const linkAction = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      await serviceRequestsApi.action(id!, action);
      const r = await serviceRequestsApi.get(id!);
      setRequest(r.data);
      setNotice(
        action === "rotate"
          ? "New link created. The previous link no longer works."
          : action === "revoke"
            ? "Private link revoked."
            : "Request cancelled.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!settings && !error)
    return <div className="service-request-page">Loading service billing…</div>;
  return (
    <main className="service-request-page">
      <Toast toast={toast} onDismiss={dismiss} />
      <header className="sr-heading">
        <div>
          <Link to="/admin/payment-requests">← Payment requests</Link>
          <p className="sr-eyebrow">Standalone services</p>
          <h1>
            {id
              ? request?.serviceDocument?.title || "Service payment request"
              : "New itemized payment request"}
          </h1>
          <p>Itemized services, clear terms, one private payment link.</p>
        </div>
        <Link
          className="sr-secondary"
          to="/admin/payment-requests/services/settings"
        >
          Service & policy settings
        </Link>
      </header>
      {!id && (
        <section className="sr-card" aria-label="Invoice draft">
          <p role="status" aria-live="polite">
            {draft.status}
          </p>
          {draft.issuing && (
            <button
              type="button"
              className="sr-primary"
              disabled={busy}
              onClick={issue}
            >
              Retry issuance
            </button>
          )}
          {draft.restored && (
            <p>Recovered your saved draft. Review it again before issuing.</p>
          )}
          {draft.error && <p role="alert">{draft.error}</p>}
          <div className="sr-actions">
            <button
              type="button"
              className="sr-secondary"
              disabled={!draft.ready || busy || draft.issuing}
              onClick={() => draftAction(draft.flush)}
            >
              Save draft now
            </button>
            <button
              type="button"
              className="sr-secondary"
              disabled={!draft.ready || busy || draft.issuing}
              onClick={() => draftAction(draft.startNew)}
            >
              New draft
            </button>
            {draft.error && !draft.issuing && (
              <button
                type="button"
                className="sr-secondary"
                onClick={draft.copy}
              >
                Save as a copy
              </button>
            )}
            <button
              type="button"
              className="sr-secondary"
              disabled={!draft.ready || busy || draft.issuing}
              onClick={() =>
                Modal.confirm({
                  title: "Discard this draft?",
                  content:
                    "This removes this saved draft and its browser recovery copy.",
                  okText: "Discard draft",
                  okButtonProps: { danger: true },
                  onOk: () => draftAction(draft.discard),
                })
              }
            >
              Discard draft
            </button>
          </div>
          {draft.drafts.length > 0 && (
            <label>
              Saved drafts
              <select
                disabled={busy || draft.issuing}
                value={draft.draftId}
                onChange={(e) =>
                  draftAction(() => draft.select(e.target.value))
                }
              >
                <option value="">Select a saved draft</option>
                {draft.drafts.map((d: any) => (
                  <option key={d.draftId} value={d.draftId}>
                    {d.payload.title || "Untitled draft"} ·{" "}
                    {d.payload.items?.length || 0} items
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}
      <Modal
        title="Change currency and clear items?"
        open={pendingCurrency !== null}
        onCancel={() => setPendingCurrency(null)}
        okText="Change currency and clear items"
        cancelText="Keep items"
        okButtonProps={{ danger: true }}
        onOk={() => {
          setCurrencyUndo({ currency, items });
          setCurrency(pendingCurrency!);
          setItems([]);
          setPendingCurrency(null);
          setPreview(false);
          setNotice(
            "Currency changed. Add items priced in the selected currency, or undo the change.",
          );
        }}
      >
        Changing currency will remove {items.length} existing items. Choose Keep
        items to preserve them.
      </Modal>
      {currencyUndo && (
        <button
          type="button"
          className="sr-secondary"
          disabled={busy || draft.issuing}
          onClick={() => {
            setCurrency(currencyUndo.currency);
            setItems(currencyUndo.items);
            setCurrencyUndo(null);
            setPreview(false);
            setNotice("Currency change undone. Your items are restored.");
          }}
        >
          Undo currency change
        </button>
      )}
      {error && (
        <p className="sr-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sr-notice" role="status">
          {notice}
        </p>
      )}
      {sending && request && (
        <EmailComposeModal
          title="Send service payment request"
          initialValues={{
            to: request.serviceDocument.client.email,
            subject: `Service payment request ${request.invoiceNumber}`,
            bodyText: `Hello ${request.serviceDocument.client.name},\n\nYour payment request for ${request.serviceDocument.title} is ready.\nTotal: ${money(request.requestedAmount, request.currency)}\n\nReview your services and payment terms at this private link:\n${getServicePaymentUrl(request)}${request.invoiceDocument && !request.publicLinkRevokedAt ? `\nInvoice PDF: ${invoiceUrl}` : ""}\n\nThank you,\nIboga Spirit`,
            clientId:
              typeof request.clientId === "object"
                ? request.clientId._id
                : request.clientId,
            relatedEntityType: "payment_request",
            relatedEntityId: id,
            requestedLanguage: request.serviceDocument.language,
          }}
          onClose={() => setSending(false)}
          onSent={async (email) => {
            if (email?.status && email.status !== "sent")
              throw new Error(
                "Delivery failed. The request has not been marked as sent.",
              );
            await serviceRequestsApi.action(id!, "sent");
            const r = await serviceRequestsApi.get(id!);
            setRequest(r.data);
            setNotice(
              "Payment request sent. Delivery is recorded in communications.",
            );
          }}
        />
      )}
      {request ? (
        <>
          <section className="sr-card">
            <div className="sr-heading">
              <div>
                <p className="sr-eyebrow">Request #{request.invoiceNumber}</p>
                <h2>{request.serviceDocument.client.name}</h2>
                <p>{request.serviceDocument.client.email}</p>
              </div>
              <strong>
                {request.status === "paid"
                  ? "Paid in full"
                  : request.status === "cancelled"
                    ? "Cancelled"
                    : `Outstanding ${money(request.amountOutstanding, request.currency)}`}
              </strong>
            </div>
            <div className="sr-table">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Quantity</th>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {request.lineItems.map((item: any, i: number) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice, request.currency)}</td>
                      <td>{money(item.amount, request.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="sr-totals">
              <div>
                <dt>Total</dt>
                <dd>{money(request.requestedAmount, request.currency)}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{money(request.amountReceived, request.currency)}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd>{money(request.amountOutstanding, request.currency)}</dd>
              </div>
            </dl>
            <h3>Payment & cancellation terms</h3>
            <p>{request.serviceDocument.policy.paymentTerms}</p>
            <p>{request.serviceDocument.policy.cancellationTerms}</p>
            <p className="sr-muted">
              {request.invoiceDocument
                ? "Issued invoice details and totals are preserved. Use an audited financial correction; the original invoice cannot be overwritten."
                : "Issued terms are preserved. To correct items, cancel this request and issue a replacement."}
            </p>
          </section>
          <section className="sr-card">
            <h2>Invoice</h2>
            {request.invoiceDocument ? (
              <>
                <p>
                  Invoice {request.invoiceDocument.number} · issued{" "}
                  {String(request.invoiceDocument.issuedAt).slice(0, 10)}
                </p>
                <p>
                  {request.invoiceDocument.recipient.name} ·{" "}
                  {request.invoiceDocument.recipient.address}
                </p>
                <div className="sr-actions">
                  <button
                    type="button"
                    disabled={invoiceBusy}
                    className="sr-primary"
                    onClick={() => invoiceAction(true)}
                  >
                    Download invoice PDF
                  </button>
                  {!request.publicLinkRevokedAt && (
                    <button
                      type="button"
                      className="sr-secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(invoiceUrl);
                          setNotice("Private invoice link copied.");
                        } catch {
                          setError(
                            "Could not copy. Copy the invoice link below.",
                          );
                        }
                      }}
                    >
                      Copy invoice link
                    </button>
                  )}
                </div>
                {!request.publicLinkRevokedAt && (
                  <label>
                    Private invoice link
                    <input readOnly value={invoiceUrl} />
                  </label>
                )}
                <p className="sr-muted">
                  Issued billing details and totals are preserved. Payment
                  status remains on the payment request.
                </p>
              </>
            ) : (
              <>
                <BillingPartyFields
                  value={billingRecipient}
                  onChange={setBillingRecipient}
                />
                <p>
                  Issue a separate invoice using the configured seller and
                  recipient billing details. This does not record a payment.
                </p>
                <button
                  type="button"
                  className="sr-primary"
                  disabled={invoiceBusy || request.status === "cancelled"}
                  onClick={() => invoiceAction()}
                >
                  Issue invoice
                </button>
                <button
                  type="button"
                  className="sr-secondary"
                  disabled={invoiceBusy}
                  onClick={() => invoiceAction("preview")}
                >
                  Preview invoice PDF
                </button>
              </>
            )}
          </section>
          <section className="sr-card">
            <h2>Share with your client</h2>
            <p>Anyone with this private link can view the payment request.</p>
            {request.publicLinkRevokedAt ? (
              <p>Link revoked</p>
            ) : (
              <>
                <label>
                  Private payment link
                  <input readOnly value={getServicePaymentUrl(request)} />
                </label>
                <div className="sr-actions">
                  <button
                    className="sr-primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          getServicePaymentUrl(request),
                        );
                        setNotice("Private link copied.");
                      } catch {
                        setError(
                          "Could not copy. Select the link and copy it manually.",
                        );
                      }
                    }}
                  >
                    Copy link
                  </button>
                  <a
                    className="sr-secondary"
                    href={getServicePaymentUrl(request)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open client page
                  </a>
                  <button
                    type="button"
                    className="sr-secondary"
                    disabled={request.status === "cancelled"}
                    onClick={() => setSending(true)}
                  >
                    Send payment request
                  </button>
                </div>
              </>
            )}
            <div className="sr-actions">
              {request.status !== "paid" && request.status !== "cancelled" && (
                <Link
                  className="sr-primary"
                  to={`/admin/payments/new?paymentRequestId=${id}`}
                >
                  Record payment
                </Link>
              )}
              <button
                disabled={busy}
                className="sr-secondary"
                onClick={() => linkAction("rotate")}
              >
                Replace private link
              </button>
              {!request.publicLinkRevokedAt && (
                <button
                  disabled={busy}
                  className="sr-secondary"
                  onClick={() => linkAction("revoke")}
                >
                  Revoke link
                </button>
              )}
              {!request.invoiceDocument &&
                request.status !== "paid" &&
                request.status !== "cancelled" && (
                  <button
                    disabled={busy}
                    className="sr-secondary"
                    onClick={() => linkAction("cancel")}
                  >
                    Cancel request
                  </button>
                )}
            </div>
          </section>
        </>
      ) : (
        !id && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (preview) issue();
              else setPreview(true);
            }}
          >
            <fieldset
              disabled={!draft.ready || busy || draft.issuing}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <section className="sr-card">
                <h2>1. Client & request</h2>
                <label>
                  Recipient type
                  <select
                    value={recipientMode}
                    onChange={(e) => {
                      setRecipientMode(e.target.value);
                      setPreview(false);
                    }}
                  >
                    <option value="client">Existing client</option>
                    <option value="recipient">One-off billing recipient</option>
                  </select>
                </label>
                {recipientMode === "client" && (
                  <div className="sr-fields">
                    <label>
                      Client
                      <SearchableClientSelect
                        ariaLabel="Client"
                        clients={clients}
                        value={clientId}
                        onChange={(selectedId) => {
                          setClient(selectedId);
                          setPreview(false);
                        }}
                        placeholder="Search by client name, email or number"
                      />
                    </label>
                  </div>
                )}
                <h3>Billing recipient</h3>
                <p className="sr-muted">
                  For a one-off recipient, enter name and email. To issue an
                  invoice, also enter their billing address. Existing clients
                  can use different company billing details.
                </p>
                <BillingPartyFields
                  value={billingRecipient}
                  onChange={(value) => {
                    setBillingRecipient(value);
                    setPreview(false);
                  }}
                />
                <div className="sr-fields">
                  <label>
                    Request title
                    <input
                      required
                      maxLength={200}
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setPreview(false);
                      }}
                    />
                  </label>
                  <label>
                    Currency
                    <select
                      value={currency}
                      onChange={(e) => {
                        if (items.length) {
                          setPendingCurrency(e.target.value);
                          return;
                        }
                        setCurrency(e.target.value);
                        setPreview(false);
                      }}
                    >
                      {["EUR", "CZK", "PLN", "USD"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Document language
                    <select
                      value={language}
                      onChange={(e) => {
                        setLanguage(e.target.value);
                        setPreview(false);
                      }}
                    >
                      {["en", "cz", "pl", "de", "ru"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due date (optional)
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDue(e.target.value);
                        setPreview(false);
                      }}
                    />
                  </label>
                  <Link to="/admin/clients/new">Create a client first ↗</Link>
                </div>
              </section>
              <section className="sr-card">
                <h2>2. Items</h2>
                <label>
                  Add a configured service
                  <select
                    value=""
                    onChange={(e) => {
                      const s = settings.services.find(
                        (s: any) => s.code === e.target.value,
                      );
                      if (s) {
                        setItems([
                          ...items,
                          {
                            type: "charge",
                            serviceCode: s.code,
                            description: [
                              s.names[language] || s.names.en,
                              s.descriptions?.[language] || s.descriptions?.en,
                            ]
                              .filter(Boolean)
                              .join(" — "),
                            quantity: 1,
                            unitPrice: s.price,
                          },
                        ]);
                        setPolicy(s.policyCode);
                        setPreview(false);
                      }
                    }}
                  >
                    <option value="">Choose a service…</option>
                    {settings?.services
                      .filter((s: any) => s.active && s.currency === currency)
                      .map((s: any) => (
                        <option key={s.code} value={s.code}>
                          {s.names.en} · {money(s.price, currency)}
                        </option>
                      ))}
                  </select>
                </label>
                {items.map((item, i) => (
                  <fieldset key={i} className="sr-item">
                    <legend>
                      {item.type === "discount" ? "Discount" : "Item"} {i + 1}
                    </legend>
                    <label>
                      Description
                      <input
                        required
                        maxLength={1000}
                        value={item.description}
                        onChange={(e) =>
                          editItem(i, "description", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min="1"
                        max="10000"
                        step="1"
                        disabled={item.type === "discount"}
                        value={item.quantity}
                        onChange={(e) =>
                          editItem(i, "quantity", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      {item.type === "discount" ? "Discount" : "Unit price"} (
                      {currency})
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          editItem(i, "unitPrice", Number(e.target.value))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="sr-secondary"
                      aria-label={`Remove item ${i + 1}`}
                      onClick={() => {
                        setItems(items.filter((_, j) => j !== i));
                        setPreview(false);
                      }}
                    >
                      Remove
                    </button>
                  </fieldset>
                ))}
                <div className="sr-actions">
                  <button
                    type="button"
                    className="sr-secondary"
                    onClick={() => {
                      setItems([
                        ...items,
                        {
                          type: "charge",
                          description: "",
                          quantity: 1,
                          unitPrice: 0,
                        },
                      ]);
                      setPreview(false);
                    }}
                  >
                    Add custom service
                  </button>
                  <button
                    type="button"
                    className="sr-secondary"
                    onClick={() => {
                      setItems([
                        ...items,
                        {
                          type: "discount",
                          description: "Discount",
                          quantity: 1,
                          unitPrice: 0,
                        },
                      ]);
                      setPreview(false);
                    }}
                  >
                    Add discount
                  </button>
                </div>
                <div className="sr-total">
                  <span>Total</span>
                  <strong>{money(total, currency)}</strong>
                </div>
              </section>
              <section className="sr-card">
                <h2>3. Payment & cancellation terms</h2>
                <label>
                  Policy template
                  <select
                    value={policyCode}
                    onChange={(e) => {
                      setPolicy(e.target.value);
                      setPreview(false);
                    }}
                  >
                    {settings?.policies.map((p: any) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>{selectedPolicy?.paymentTerms}</p>
                <p>{selectedPolicy?.cancellationTerms}</p>
                <p className="sr-muted">
                  Full payment upfront is a payment term. “Paid in full” appears
                  only after the payments settle the request.
                </p>
              </section>
              <section className="sr-card">
                <h2>4. Payment instructions</h2>
                <label>
                  Recipients
                  <select
                    value={overrideMethods ? "custom" : "default"}
                    onChange={(e) => {
                      setOverrideMethods(e.target.value === "custom");
                      setPreview(false);
                    }}
                  >
                    <option value="default">
                      Use configured payment methods
                    </option>
                    <option value="custom">Override for this request</option>
                  </select>
                </label>
                {overrideMethods && (
                  <div className="sr-fields">
                    {Object.entries(methods || {}).map(([key, value]) => (
                      <label key={key}>
                        {key}
                        <input
                          required
                          value={String(value)}
                          onChange={(e) => {
                            setMethods({ ...methods, [key]: e.target.value });
                            setPreview(false);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>
              {preview && (
                <section className="sr-card sr-preview">
                  <h2>Ready to issue</h2>
                  <p>
                    {billingRecipient.name ||
                      clients.find((c) => c._id === clientId)?.firstName}{" "}
                    {clients.find((c) => c._id === clientId)?.lastName} ·{" "}
                    {title}
                  </p>
                  <strong>{money(total, currency)}</strong>
                  <p>
                    Items, client details and terms will be preserved on this
                    request. Issuing creates the private link; it does not send
                    an email.
                  </p>
                </section>
              )}
              <div className="sr-actions">
                <button
                  disabled={!valid || busy || !draft.ready}
                  className="sr-primary"
                  type="submit"
                >
                  {busy
                    ? "Issuing…"
                    : preview
                      ? "Issue payment request"
                      : "Review request"}
                </button>
                {preview && (
                  <button
                    type="button"
                    className="sr-secondary"
                    onClick={() => setPreview(false)}
                  >
                    Back to editing
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        )
      )}
      {id && request && <InvoiceVisitHistory key={id} requestId={id} />}
    </main>
  );
}
