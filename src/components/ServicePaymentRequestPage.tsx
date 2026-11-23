import PaymentRequestShare from './PaymentRequestShare';
import { MONEY_CURRENCIES } from '../config/moneyCurrencies';
import DuplicatePaymentRequestButton from './DuplicatePaymentRequestButton';
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
import EmailComposeModal from "./EmailComposeModal";
import SearchableClientSelect from "./SearchableClientSelect";
import AppleButton from "./AppleButton";
import AppleInput from "./AppleInput";
import { Card, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "./ui";

const selectClasses = "w-full p-2 border border-apple-gray-200 rounded-apple bg-white text-apple-gray-900 focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue";
const labelClasses = "flex flex-col gap-1.5 text-sm font-medium text-apple-gray-700";
const linkButtonClasses = "inline-flex items-center justify-center rounded-apple px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200";
const primaryLinkClasses = `${linkButtonClasses} bg-apple-blue text-white hover:bg-blue-600 shadow-apple-sm`;
const secondaryLinkClasses = `${linkButtonClasses} bg-apple-gray-50 text-apple-gray-600 border border-apple-gray-200 hover:bg-white`;
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
  const initialDraftId = new URLSearchParams(location.search).get("draftId");
  const duplicateFrom = new URLSearchParams(location.search).get("duplicateFrom");
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
    initialDraftId,
    onIssued: (requestId) =>
      navigate(`/admin/payment-requests/services/${requestId}`),
  });
  useEffect(() => {
    if (!id && duplicateFrom && draft.ready && draft.draftId && draft.draftId !== initialDraftId) {
      const query = new URLSearchParams(location.search);
      query.set('draftId', draft.draftId);
      navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
    }
  }, [id, duplicateFrom, draft.ready, draft.draftId, initialDraftId, location.pathname, location.search, navigate]);
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
    return <div className="mx-auto max-w-[1040px] px-6 py-8 text-apple-gray-900">Loading service billing…</div>;
  return (
    <main className="mx-auto max-w-[1040px] px-6 py-8 text-apple-gray-900">
      <Toast toast={toast} onDismiss={dismiss} />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link to="/admin/payment-requests" className="text-sm text-apple-blue hover:underline">← Payment requests</Link>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-apple-gray-500">Standalone services</p>
          <h1 className="text-[30px] font-bold tracking-tight">
            {id
              ? request?.serviceDocument?.title || "Service payment request"
              : "New itemized payment request"}
          </h1>
          <p className="mt-2 text-apple-gray-500">Itemized services, clear terms, one private payment link.</p>
        </div>
        <Link
          className={secondaryLinkClasses}
          to="/admin/payment-requests/services/settings"
        >
          Service & policy settings
        </Link>
      </header>
      {id && request && <div className="mb-4"><DuplicatePaymentRequestButton request={request}/></div>}
      {!id && duplicateFrom && <Card className="mb-5"><p role="status">New draft copied from payment request. Review the recipient, items and a new due date before issuing. Nothing has been sent. <Link to={`/admin/payment-requests/services/${encodeURIComponent(duplicateFrom)}`} className="text-apple-blue hover:underline">View original request</Link></p></Card>}
      {!id && (
        <section aria-label="Invoice draft">
        <Card className="mb-5">
          <p role="status" aria-live="polite">
            {draft.status}
          </p>
          {draft.issuing && (
            <AppleButton
              type="button"
              className="mt-3"
              disabled={busy}
              onClick={issue}
            >
              Retry issuance
            </AppleButton>
          )}
          {draft.restored && (
            <p className="mt-2">Recovered your saved draft. Review it again before issuing.</p>
          )}
          {draft.error && <p role="alert" className="mt-2 text-apple-red">{draft.error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <AppleButton
              type="button"
              variant="secondary"
              disabled={!draft.ready || busy || draft.issuing}
              onClick={() => draftAction(draft.flush)}
            >
              Save draft now
            </AppleButton>
            <AppleButton
              type="button"
              variant="secondary"
              disabled={!draft.ready || busy || draft.issuing}
              onClick={() => draftAction(draft.startNew)}
            >
              New draft
            </AppleButton>
            {draft.error && !draft.issuing && (
              <AppleButton
                type="button"
                variant="secondary"
                onClick={draft.copy}
              >
                Save as a copy
              </AppleButton>
            )}
            <AppleButton
              type="button"
              variant="secondary"
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
            </AppleButton>
          </div>
          {draft.drafts.length > 0 && (
            <label className={`${labelClasses} mt-4`}>
              Saved drafts
              <select
                disabled={busy || draft.issuing}
                value={draft.draftId}
                onChange={(e) =>
                  draftAction(() => draft.select(e.target.value))
                }
                className={selectClasses}
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
        </Card>
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
        <AppleButton
          type="button"
          variant="secondary"
          className="mb-4"
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
        </AppleButton>
      )}
      {error && (
        <p className="mb-4 rounded-apple bg-red-50 px-4 py-3 text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-apple bg-emerald-50 px-4 py-3 text-emerald-800" role="status">
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
          <Card className="mb-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-apple-gray-500">Request #{request.invoiceNumber}</p>
                <h2 className="text-xl font-bold">{request.serviceDocument.client.name}</h2>
                <p className="mt-1 text-apple-gray-600">{request.serviceDocument.client.email}</p>
              </div>
              <strong>
                {request.status === "paid"
                  ? "Paid in full"
                  : request.status === "cancelled"
                    ? "Cancelled"
                    : `Outstanding ${money(request.amountOutstanding, request.currency)}`}
              </strong>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Service</TableHeaderCell>
                  <TableHeaderCell>Quantity</TableHeaderCell>
                  <TableHeaderCell>Unit price</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {request.lineItems.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{money(item.unitPrice, request.currency)}</TableCell>
                    <TableCell>{money(item.amount, request.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="ml-auto mt-5 max-w-[380px]">
              <div className="flex justify-between py-2">
                <dt>Total</dt>
                <dd>{money(request.requestedAmount, request.currency)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt>Received</dt>
                <dd>{money(request.amountReceived, request.currency)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt>Outstanding</dt>
                <dd>{money(request.amountOutstanding, request.currency)}</dd>
              </div>
            </dl>
            <h3 className="mb-2.5 mt-5 font-semibold">Payment & cancellation terms</h3>
            <p className="my-2.5 leading-relaxed">{request.serviceDocument.policy.paymentTerms}</p>
            <p className="my-2.5 leading-relaxed">{request.serviceDocument.policy.cancellationTerms}</p>
            <p className="text-sm text-apple-gray-500">
              {request.invoiceDocument
                ? "Issued invoice details and totals are preserved. Use an audited financial correction; the original invoice cannot be overwritten."
                : "Issued terms are preserved. To correct items, cancel this request and issue a replacement."}
            </p>
          </Card>
          <PaymentRequestShare key={request._id} request={request} />
          <Card className="mb-5">
            <h2 className="mb-4 text-xl font-bold">Invoice</h2>
            {request.invoiceDocument ? (
              <>
                <p className="my-2.5">
                  Invoice {request.invoiceDocument.number} · issued{" "}
                  {String(request.invoiceDocument.issuedAt).slice(0, 10)}
                </p>
                <p className="my-2.5">
                  {request.invoiceDocument.recipient.name} ·{" "}
                  {request.invoiceDocument.recipient.address}
                </p>
                <div className="flex flex-wrap gap-3">
                  <AppleButton
                    type="button"
                    disabled={invoiceBusy}
                    onClick={() => invoiceAction(true)}
                  >
                    Download invoice PDF
                  </AppleButton>
                  {!request.publicLinkRevokedAt && (
                    <AppleButton
                      type="button"
                      variant="secondary"
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
                    </AppleButton>
                  )}
                </div>
                {!request.publicLinkRevokedAt && (
                  <label className={`${labelClasses} mt-4`}>
                    Private invoice link
                    <input readOnly value={invoiceUrl} className={selectClasses} />
                  </label>
                )}
                <p className="mt-4 text-sm text-apple-gray-500">
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
                <p className="my-2.5">
                  Issue a separate invoice using the configured seller and
                  recipient billing details. This does not record a payment.
                </p>
                <div className="flex flex-wrap gap-3">
                  <AppleButton
                    type="button"
                    disabled={invoiceBusy || request.status === "cancelled"}
                    onClick={() => invoiceAction()}
                  >
                    Issue invoice
                  </AppleButton>
                  <AppleButton
                    type="button"
                    variant="secondary"
                    disabled={invoiceBusy}
                    onClick={() => invoiceAction("preview")}
                  >
                    Preview invoice PDF
                  </AppleButton>
                </div>
              </>
            )}
          </Card>
          <Card className="mb-5">
            <h2 className="mb-2 text-xl font-bold">Share with your client</h2>
            <p className="mb-4">Anyone with this private link can view the payment request.</p>
            {request.publicLinkRevokedAt ? (
              <p>Link revoked</p>
            ) : (
              <>
                <label className={labelClasses}>
                  Private payment link
                  <input readOnly value={getServicePaymentUrl(request)} className={selectClasses} />
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <AppleButton
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
                  </AppleButton>
                  <a
                    className={secondaryLinkClasses}
                    href={getServicePaymentUrl(request)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open client page
                  </a>
                  <AppleButton
                    type="button"
                    variant="secondary"
                    disabled={request.status === "cancelled"}
                    onClick={() => setSending(true)}
                  >
                    Send payment request
                  </AppleButton>
                </div>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {request.status !== "paid" && request.status !== "cancelled" && (
                <Link
                  className={primaryLinkClasses}
                  to={`/admin/payments/new?paymentRequestId=${id}`}
                >
                  Record payment
                </Link>
              )}
              <AppleButton
                variant="secondary"
                disabled={busy}
                onClick={() => linkAction("rotate")}
              >
                Replace private link
              </AppleButton>
              {!request.publicLinkRevokedAt && (
                <AppleButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() => linkAction("revoke")}
                >
                  Revoke link
                </AppleButton>
              )}
              {!request.invoiceDocument &&
                request.status !== "paid" &&
                request.status !== "cancelled" && (
                  <AppleButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => linkAction("cancel")}
                  >
                    Cancel request
                  </AppleButton>
                )}
            </div>
          </Card>
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
              <Card className="mb-5">
                <h2 className="mb-4 text-xl font-bold">1. Client & request</h2>
                <label className={labelClasses}>
                  Recipient type
                  <select
                    value={recipientMode}
                    onChange={(e) => {
                      setRecipientMode(e.target.value);
                      setPreview(false);
                    }}
                    className={selectClasses}
                  >
                    <option value="client">Existing client</option>
                    <option value="recipient">One-off billing recipient</option>
                  </select>
                </label>
                {recipientMode === "client" && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClasses}>
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
                <h3 className="mb-2.5 mt-5 font-semibold">Billing recipient</h3>
                <p className="mb-4 text-sm text-apple-gray-500">
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
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AppleInput
                    label="Request title"
                    required
                    maxLength={200}
                    value={title}
                    onChange={(value) => {
                      setTitle(value);
                      setPreview(false);
                    }}
                  />
                  <label className={labelClasses}>
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
                      className={selectClasses}
                    >
                      {MONEY_CURRENCIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClasses}>
                    Document language
                    <select
                      value={language}
                      onChange={(e) => {
                        setLanguage(e.target.value);
                        setPreview(false);
                      }}
                      className={selectClasses}
                    >
                      {["en", "cz", "pl", "de", "ru"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <AppleInput
                    label="Due date (optional)"
                    type="date"
                    value={dueDate}
                    onChange={(value) => {
                      setDue(value);
                      setPreview(false);
                    }}
                  />
                  <Link to="/admin/clients/new" className="text-sm text-apple-blue hover:underline self-center">Create a client first ↗</Link>
                </div>
              </Card>
              <Card className="mb-5">
                <h2 className="mb-4 text-xl font-bold">2. Items</h2>
                <label className={labelClasses}>
                  Add a configured service
                  <select
                    value=""
                    className={selectClasses}
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
                  <fieldset key={i} className="mt-4 grid grid-cols-1 sm:grid-cols-[2fr_0.7fr_1fr_auto] gap-3.5 items-end border-t border-apple-gray-200 pt-4">
                    <legend className="col-span-full text-xs text-apple-gray-500 pt-2 sm:pt-0">
                      {item.type === "discount" ? "Discount" : "Item"} {i + 1}
                    </legend>
                    <AppleInput
                      label="Description"
                      required
                      maxLength={1000}
                      value={item.description}
                      onChange={(value) =>
                        editItem(i, "description", value)
                      }
                    />
                    <AppleInput
                      label="Quantity"
                      required
                      type="number"
                      min="1"
                      max="10000"
                      disabled={item.type === "discount"}
                      value={item.quantity}
                      onChange={(value) =>
                        editItem(i, "quantity", Number(value))
                      }
                    />
                    <AppleInput
                      label={`${item.type === "discount" ? "Discount" : "Unit price"} (${currency})`}
                      required
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(value) =>
                        editItem(i, "unitPrice", Number(value))
                      }
                    />
                    <AppleButton
                      type="button"
                      variant="secondary"
                      aria-label={`Remove item ${i + 1}`}
                      onClick={() => {
                        setItems(items.filter((_, j) => j !== i));
                        setPreview(false);
                      }}
                    >
                      Remove
                    </AppleButton>
                  </fieldset>
                ))}
                <div className="mt-5 flex flex-wrap gap-3">
                  <AppleButton
                    type="button"
                    variant="secondary"
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
                  </AppleButton>
                  <AppleButton
                    type="button"
                    variant="secondary"
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
                  </AppleButton>
                </div>
                <div className="mt-6 flex justify-between border-t border-apple-gray-200 pt-5 text-xl">
                  <span>Total</span>
                  <strong>{money(total, currency)}</strong>
                </div>
              </Card>
              <Card className="mb-5">
                <h2 className="mb-4 text-xl font-bold">3. Payment & cancellation terms</h2>
                <label className={labelClasses}>
                  Policy template
                  <select
                    value={policyCode}
                    onChange={(e) => {
                      setPolicy(e.target.value);
                      setPreview(false);
                    }}
                    className={selectClasses}
                  >
                    {settings?.policies.map((p: any) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="my-2.5">{selectedPolicy?.paymentTerms}</p>
                <p className="my-2.5">{selectedPolicy?.cancellationTerms}</p>
                <p className="text-sm text-apple-gray-500">
                  Full payment upfront is a payment term. “Paid in full” appears
                  only after the payments settle the request.
                </p>
              </Card>
              <Card className="mb-5">
                <h2 className="mb-4 text-xl font-bold">4. Payment instructions</h2>
                <label className={labelClasses}>
                  Recipients
                  <select
                    value={overrideMethods ? "custom" : "default"}
                    onChange={(e) => {
                      setOverrideMethods(e.target.value === "custom");
                      setPreview(false);
                    }}
                    className={selectClasses}
                  >
                    <option value="default">
                      Use configured payment methods
                    </option>
                    <option value="custom">Override for this request</option>
                  </select>
                </label>
                {overrideMethods && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(methods || {}).map(([key, value]) => (
                      <AppleInput
                        key={key}
                        label={key}
                        required
                        value={String(value)}
                        onChange={(v) => {
                          setMethods({ ...methods, [key]: v });
                          setPreview(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </Card>
              {preview && (
                <Card className="mb-5 border-apple-teal bg-teal-50/40">
                  <h2 className="mb-4 text-xl font-bold">Ready to issue</h2>
                  <p className="my-2.5">
                    {billingRecipient.name ||
                      clients.find((c) => c._id === clientId)?.firstName}{" "}
                    {clients.find((c) => c._id === clientId)?.lastName} ·{" "}
                    {title}
                  </p>
                  <strong>{money(total, currency)}</strong>
                  <p className="my-2.5">
                    Items, client details and terms will be preserved on this
                    request. Issuing creates the private link; it does not send
                    an email.
                  </p>
                </Card>
              )}
              <div className="flex flex-wrap gap-3">
                <AppleButton
                  disabled={!valid || busy || !draft.ready}
                  type="submit"
                >
                  {busy
                    ? "Issuing…"
                    : preview
                      ? "Issue payment request"
                      : "Review request"}
                </AppleButton>
                {preview && (
                  <AppleButton
                    type="button"
                    variant="secondary"
                    onClick={() => setPreview(false)}
                  >
                    Back to editing
                  </AppleButton>
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
