import React from "react";
import { nonCashValue } from "./nonCashSettlement";
export type NonCashForm = {
  nonCash: boolean;
  nonCashDescription: string;
  nonCashQuantity: string;
  nonCashUnitValue: string;
  nonCashValuationNotes: string;
  currency: string;
};
export default function NonCashSettlementFields({
  value,
  onChange,
  isExisting,
  readOnly = false,
  disabled = false,
}: {
  value: NonCashForm;
  onChange: (patch: Partial<Omit<NonCashForm, "currency">>) => void;
  isExisting: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const amount = nonCashValue(value.nonCashQuantity, value.nonCashUnitValue);
  return (
    <section
      className="col-span-full min-w-0 rounded-xl border border-violet-200 bg-violet-50 p-4"
      aria-label="Other non-cash settlement"
    >
      <label className="flex items-start gap-2 font-semibold">
        <input
          type="checkbox"
          checked={value.nonCash}
          disabled={readOnly || isExisting || disabled}
          onChange={(e) => onChange({ nonCash: e.target.checked })}
          className="mt-1"
        />
        Goods or services instead of money (non-cash / barter)
      </label>
      {isExisting && (
        <p className="mt-2 text-sm text-slate-600">
          Payment nature is fixed after saving. Record a separate delivery
          rather than reclassifying money.
        </p>
      )}
      {disabled && (
        <p className="mt-2 text-sm text-slate-600">
          Use a retreat booking or client payment for non-cash settlements.
          Issued standalone invoice allocations remain monetary.
        </p>
      )}
      {value.nonCash && (
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="col-span-full min-w-0 text-sm font-medium">
            Goods or services received
            <textarea
              aria-label="Goods or services received"
              rows={2}
              maxLength={500}
              required
              disabled={readOnly}
              value={value.nonCashDescription}
              onChange={(e) => onChange({ nonCashDescription: e.target.value })}
              className="mt-1 w-full rounded border bg-white p-2"
              placeholder="For example: painting, delivery 1 of 10"
            />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Quantity
            <input
              aria-label="Non-cash quantity"
              type="number"
              min="0.001"
              max="1000000"
              step="0.001"
              required
              disabled={readOnly}
              value={value.nonCashQuantity}
              onChange={(e) => onChange({ nonCashQuantity: e.target.value })}
              className="mt-1 w-full rounded border bg-white p-2"
            />
          </label>
          <label className="min-w-0 text-sm font-medium">
            Agreed value per item ({value.currency})
            <input
              aria-label="Non-cash value per item"
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              required
              disabled={readOnly}
              value={value.nonCashUnitValue}
              onChange={(e) => onChange({ nonCashUnitValue: e.target.value })}
              className="mt-1 w-full rounded border bg-white p-2"
            />
          </label>
          <label className="col-span-full min-w-0 text-sm font-medium">
            Valuation explanation (internal, optional)
            <textarea
              aria-label="Non-cash valuation explanation"
              rows={2}
              maxLength={2000}
              disabled={readOnly}
              value={value.nonCashValuationNotes}
              onChange={(e) =>
                onChange({ nonCashValuationNotes: e.target.value })
              }
              className="mt-1 w-full rounded border bg-white p-2"
              placeholder="What was agreed, condition of the goods, or other context"
            />
          </label>
          <p className="col-span-full text-sm">
            <strong>
              Settlement value:{" "}
              {amount === undefined
                ? "Enter a valid quantity and unit value"
                : amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) +
                  " " +
                  value.currency}
            </strong>
            <br />
            Only accepted/completed deliveries reduce the balance. Record future
            deliveries as Pending. This value is not cash received; standard
            cash receipts and cash refunds do not apply.
          </p>
        </div>
      )}
    </section>
  );
}
