import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { clientsApi, serviceRequestsApi } from "../services/api";
import { getServicePaymentUrl } from "./paymentRequestLinks";
import "./ServicePaymentRequestPage.css";
import EmailComposeModal from "./EmailComposeModal";
const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).format(
    n || 0,
  );
const errorText = (e: any) =>
  e?.response?.data?.message ||
  e.message ||
  "Unable to save. Please try again.";
export default function ServicePaymentRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null),
    [clients, setClients] = useState<any[]>([]),
    [request, setRequest] = useState<any>(null);
  const [clientId, setClient] = useState(""),
    [search, setSearch] = useState(""),
    [title, setTitle] = useState("Service payment request"),
    [currency, setCurrency] = useState("EUR"),
    [policyCode, setPolicy] = useState(""),
    [dueDate, setDue] = useState("");
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
        if (r) setRequest(r.data);
      })
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [id]);
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
    clientId &&
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
      const response = await serviceRequestsApi.create({
        clientId,
        title,
        currency,
        policyCode,
        dueDate: dueDate || undefined,
        lineItems: items,
        requestedAmount: total,
        language,
        paymentMethods: overrideMethods ? methods : undefined,
      });
      navigate(`/admin/payment-requests/services/${response.data._id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
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
      <header className="sr-heading">
        <div>
          <Link to="/admin/payment-requests">← Payment requests</Link>
          <p className="sr-eyebrow">Standalone services</p>
          <h1>
            {id
              ? request?.serviceDocument?.title || "Service payment request"
              : "New service payment request"}
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
            bodyText: `Hello ${request.serviceDocument.client.name},\n\nYour payment request for ${request.serviceDocument.title} is ready.\nTotal: ${money(request.requestedAmount, request.currency)}\n\nReview your services and payment terms at this private link:\n${getServicePaymentUrl(request)}\n\nThank you,\nIboga Spirit`,
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
              Issued terms are preserved. To correct items, cancel this request
              and issue a replacement.
            </p>
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
              {request.status !== "paid" && request.status !== "cancelled" && (
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
            <section className="sr-card">
              <h2>1. Client & request</h2>
              <div className="sr-fields">
                <label>
                  Find client
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or email"
                  />
                </label>
                <label>
                  Client
                  <select
                    required
                    value={clientId}
                    onChange={(e) => {
                      setClient(e.target.value);
                      setPreview(false);
                    }}
                  >
                    <option value="">Select a client</option>
                    {clients
                      .filter((c) =>
                        [c.firstName, c.lastName, c.email]
                          .join(" ")
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.firstName} {c.lastName} · {c.email}
                        </option>
                      ))}
                  </select>
                </label>
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
                      setCurrency(e.target.value);
                      setItems([]);
                      setNotice(
                        "Currency changed. Add items priced in the selected currency.",
                      );
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
                  {clients.find((c) => c._id === clientId)?.firstName}{" "}
                  {clients.find((c) => c._id === clientId)?.lastName} · {title}
                </p>
                <strong>{money(total, currency)}</strong>
                <p>
                  Items, client details and terms will be preserved on this
                  request. Issuing creates the private link; it does not send an
                  email.
                </p>
              </section>
            )}
            <div className="sr-actions">
              <button
                disabled={!valid || busy}
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
          </form>
        )
      )}
    </main>
  );
}
