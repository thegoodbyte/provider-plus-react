import React from "react";
import { Link } from "react-router-dom";
export type PaymentSearch = {
  term?: string;
  amount: string;
  dateFrom: string;
  dateTo: string;
  matchMode: string;
  page: number;
};
export const emptyPaymentSearch: PaymentSearch = {
  term: "",
  amount: "",
  dateFrom: "",
  dateTo: "",
  matchMode: "all",
  page: 1,
};
export default function ExistingPaymentPicker({
  filters,
  onFilters,
  data,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  unavailable,
  help,
}: {
  filters: PaymentSearch;
  onFilters: (value: Partial<PaymentSearch>) => void;
  data: any;
  loading: boolean;
  error: string;
  onRetry: () => void;
  selectedId: string;
  onSelect: (payment: any | null) => void;
  unavailable?: (payment: any) => boolean;
  help?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Client name, payment / PR / booking number or reference<input className="rounded border p-2" value={filters.term || ""} onChange={e => onFilters({term:e.target.value})} /></label>
        <label className="grid gap-1 text-sm">
          Payment amount
          <input
            className="rounded border p-2"
            type="number"
            min="0.01"
            step="0.01"
            value={filters.amount}
            onChange={(e) => onFilters({ amount: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Match filters
          <select
            className="rounded border p-2"
            value={filters.matchMode}
            onChange={(e) => onFilters({ matchMode: e.target.value })}
          >
            <option value="all">Match all filters</option>
            <option value="any">Match any filter</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Payment date from
          <input
            className="rounded border p-2"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilters({ dateFrom: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Payment date to
          <input
            className="rounded border p-2"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilters({ dateTo: e.target.value })}
          />
        </label>
      </div>
      <button
        type="button"
        className="rounded border px-3 py-2 text-sm"
        onClick={() => onFilters(emptyPaymentSearch)}
      >
        Clear payment filters
      </button>
      <p className="text-xs text-slate-600">
        {help ||
          "Clear any filter to search independently. Dates include the whole day (UTC). Select one payment below."}
      </p>
      <p role="status" className="text-sm text-slate-700">
        {filters.matchMode === "any"
          ? "Match any: a payment can match any optional filter. Results may fall outside the chosen dates."
          : "Match all: payments must match every filled filter. Clear a filter to broaden the search."}
      </p>
      <div
        className="rounded-lg bg-slate-50 p-3"
        aria-label="Payment search results"
      >
        <p className="mb-2 text-sm font-medium">
          Existing payments
          {data.total !== undefined ? ` · ${data.total} results` : ""}
        </p>
        {loading ? (
          <p role="status">Loading matching payments…</p>
        ) : error ? (
          <p role="alert">
            {error}{" "}
            <button type="button" className="underline" onClick={onRetry}>
              Retry matching payments
            </button>
          </p>
        ) : data.payments?.length ? (
          data.payments.map((p: any) => (
            <label
              className="mb-2 flex items-start gap-3 rounded border bg-white p-3 text-sm"
              key={p._id}
            >
              <input
                type="checkbox"
                aria-label={`Select payment #${p.display_id || p._id}`}
                checked={selectedId === p._id}
                disabled={
                  Boolean(p.unavailableReason) || Boolean(unavailable?.(p))
                }
                onChange={(e) => onSelect(e.target.checked ? p : null)}
              />
              <span className="min-w-0 break-words">
                <Link
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                  to={`/admin/payments/${p._id}`}
                >
                  Payment #{p.display_id || p._id}
                </Link>{" "}
                · {p.clientName || "Client unavailable"}
                {p.bookingNumber ? ` · Booking #${p.bookingNumber}` : ""}
                <br />
                {String(p.paymentDate || "").slice(0, 10)} · {p.amount}{" "}
                {p.currency} ·{" "}
                {p.paymentMethod === "bank_transfer"
                  ? "Bank transfer"
                  : p.paymentMethod}{" "}
                · {p.receivingAccount || "Account not recorded"}
                <br />
                {p.transactionReference || p.transactionId || "No reference"}
                {p.sourceScratchpadId && (
                  <span className="block">Recorded from scratchpad</span>
                )}
                {p.unavailableReason && (
                  <strong className="block text-amber-800">
                    {p.unavailableReason}
                  </strong>
                )}
              </span>
            </label>
          ))
        ) : (
          <p className="text-sm text-slate-600">No matching payment found.</p>
        )}
        {Boolean(data.total && data.limit && data.total > data.limit) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border p-2"
              disabled={loading || filters.page <= 1}
              onClick={() => onFilters({ page: filters.page - 1 })}
            >
              Previous payments
            </button>
            <span>Page {filters.page}</span>
            <button
              type="button"
              className="rounded border p-2"
              disabled={
                loading ||
                filters.page * (data.limit || 25) >= (data.total || 0)
              }
              onClick={() => onFilters({ page: filters.page + 1 })}
            >
              Next payments
            </button>
          </div>
        )}
      </div>
    </>
  );
}
