import { useFinancePermission } from "./FinanceAccessContext";
import React, { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { api } from "../services/api";
import BookingPaymentManagement from "../components/BookingPaymentManagement";
import CurrencyDisplay from "../components/CurrencyDisplay";
const oid = (v: any) => (typeof v === "object" ? v?._id : v);
const label = (v: any) =>
  typeof v === "object"
    ? [v.firstName, v.lastName].filter(Boolean).join(" ") ||
      v.name ||
      v.code ||
      v.bookingNumber ||
      v._id
    : String(v || "");
export default function FinancialContextPage({
  kind,
}: {
  kind: "clients" | "bookings" | "retreats";
}) {
  const can = useFinancePermission();
  const params = useParams(),
    location = useLocation(),
    id = params.id;
  const [records, setRecords] = useState<any[]>([]),
    [related, setRelated] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [payments, setPayments] = useState<any[]>([]),
    [requests, setRequests] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRecords([]);
    setRelated([]);
    setPayments([]);
    setRequests([]);
    const load = async () => {
      const response = await api.get(`/${kind}${id ? "/" + id : ""}`, {
        headers: { "X-Work-Mode": "payments" },
      });
      if (!active) return;
      setRecords(id ? [response.data] : response.data || []);
      if (id && kind !== "bookings") {
        const response = await api.get(
          `/bookings?${kind === "clients" ? "clientId" : "retreatId"}=${encodeURIComponent(id)}`,
          { headers: { "X-Work-Mode": "payments" } },
        );
        if (active) setRelated(response.data || []);
        if (kind === "clients") {
          const [p, q] = await Promise.all([
            api.get(`/payments/by-client/${id}`),
            api.get(`/payment-requests?clientId=${id}`),
          ]);
          if (active) {
            setPayments(p.data || []);
            setRequests(q.data || []);
          }
        }
      }
    };
    load()
      .catch(() => {
        if (active)
          setError("Financial records could not be loaded. Reload to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, id]);
  const links = (r: any) => (
    <div className="finance-context-links">
      {r.clientId && (
        <Link to={`/admin/clients/${oid(r.clientId)}`}>
          Client #{r.clientId.display_id || label(r.clientId)}
        </Link>
      )}
      {r.retreatId && (
        <Link to={`/admin/retreats/${oid(r.retreatId)}`}>
          Retreat {label(r.retreatId)}
        </Link>
      )}
    </div>
  );
  return (
    <section className="finance-context">
      <h1>
        {id
          ? `${kind === "clients" ? "Client" : kind === "bookings" ? "Booking" : "Retreat"} financial overview`
          : kind[0].toUpperCase() + kind.slice(1)}
      </h1>
      <p>
        Payment information and the details needed to identify the client and
        stay.
      </p>
      {id && <Link to={`/admin/${kind}`}>← All {kind}</Link>}
      {kind === "bookings" && can("finance.bookings") && (
        <Link to="/admin/bookings/new">Create booking</Link>
      )}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading financial records…</p>
      ) : (
        <>
          {!id && (
            <label>
              Search {kind}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
          <div className="finance-records">
            {records
              .filter(
                (r) =>
                  !search ||
                  `${label(r)} ${r.email || ""} ${r.display_id || r.bookingNumber || ""}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((r) => (
                <article key={r._id}>
                  <h2>
                    {kind === "bookings"
                      ? `Booking #${r.bookingNumber || r.bookingHash}`
                      : kind === "clients"
                        ? `#${r.display_id || ""} ${label(r)}`
                        : r.code || r.name}
                  </h2>
                  {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
                  {r.phone && <a href={`tel:${r.phone}`}>{r.phone}</a>}
                  {links(r)}
                  {!id && (
                    <Link to={`/admin/${kind}/${r._id}`}>
                      Open financial details →
                    </Link>
                  )}
                  {id && kind === "bookings" && (
                    <BookingPaymentManagement
                      bookingId={r._id}
                      bookingNumber={r.bookingNumber}
                      bookingHash={r.bookingHash}
                      clientId={oid(r.clientId)}
                      clientName={label(r.clientId)}
                      retreatId={oid(r.retreatId)}
                      totalAmount={r.totalAmount || 0}
                      currency={r.currency || "PLN"}
                      pricingSummary={r.pricingSummary}
                    />
                  )}
                </article>
              ))}
          </div>
          {id && kind === "clients" && (
            <>
              <section>
                <h2>Payment requests</h2>
                {requests.map((r) => (
                  <article className="finance-booking-row" key={r._id}>
                    <Link to={`/admin/payment-requests/${r._id}`}>
                      Request #{r.invoiceNumber || r.display_id}
                    </Link>
                    <span>{r.status}</span>
                    <CurrencyDisplay
                      amount={r.requestedAmount}
                      currency={r.currency}
                      showUSD={false}
                    />
                  </article>
                ))}
                {!requests.length && <p>No payment requests.</p>}
              </section>
              <section>
                <h2>Payment transactions</h2>
                {payments.map((p) => (
                  <article className="finance-booking-row" key={p._id}>
                    <Link to={`/admin/payments/${p._id}`}>
                      Payment #{p.display_id}
                    </Link>
                    <span>{p.status}</span>
                    <CurrencyDisplay
                      amount={p.amount}
                      currency={p.currency}
                      showUSD={false}
                    />
                  </article>
                ))}
                {!payments.length && <p>No payment transactions.</p>}
              </section>
            </>
          )}
          {id && kind !== "bookings" && (
            <section>
              <h2>Bookings & balances</h2>
              {related.length === 0 ? (
                <p>No bookings linked.</p>
              ) : (
                related.map((r) => <BookingFinancialRow key={r._id} row={r} />)
              )}
            </section>
          )}
          {!loading && !records.length && !error && (
            <p>No financial records found.</p>
          )}
        </>
      )}
    </section>
  );
}
function BookingFinancialRow({ row }: { row: any }) {
  const [summary, setSummary] = useState<any>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get(`/payments/booking/${row._id}/financial-summary`)
      .then((r) => {
        if (active) setSummary(r.data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [row._id]);
  return (
    <article className="finance-booking-row">
      <Link to={`/admin/bookings/${row._id}`}>
        Booking #{row.bookingNumber || row.bookingHash}
      </Link>
      <span>
        {label(row.clientId)} · {label(row.retreatId)}
      </span>
      {error ? (
        <p role="status">Balance unavailable</p>
      ) : !summary ? (
        <span>Loading balance…</span>
      ) : (
        <dl>
          <div>
            <dt>Agreed price</dt>
            <dd>
              <CurrencyDisplay
                amount={summary.price}
                currency={summary.currency}
                showUSD={false}
              />
            </dd>
          </div>
          <div>
            <dt>Paid after refunds</dt>
            <dd>
              <CurrencyDisplay
                amount={summary.netPaid}
                currency={summary.currency}
                showUSD={false}
              />
            </dd>
          </div>
          <div>
            <dt>Balance</dt>
            <dd>
              <CurrencyDisplay
                amount={summary.balance}
                currency={summary.currency}
                showUSD={false}
              />
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}
