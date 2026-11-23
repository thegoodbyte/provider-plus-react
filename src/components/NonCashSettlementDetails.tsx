import React from "react";
import { NonCashSettlement } from "../types";
export default function NonCashSettlementDetails({
  value,
  currency,
  compact = false,
}: {
  value?: NonCashSettlement;
  currency: string;
  compact?: boolean;
}) {
  if (!value) return null;
  return (
    <div
      className={
        compact
          ? "mt-1 max-w-xs whitespace-normal text-xs text-violet-800"
          : "my-3 min-w-0 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm"
      }
    >
      <strong>Non-cash settlement · not money received</strong>
      <p className="break-words">{value.description}</p>
      <p>
        {value.quantity.toLocaleString()} ×{" "}
        {value.unitValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{" "}
        {currency}
      </p>
      {value.valuationNotes && (
        <p className="whitespace-pre-wrap break-words">
          {value.valuationNotes}
        </p>
      )}
    </div>
  );
}
