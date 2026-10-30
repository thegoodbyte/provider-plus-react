export const emptyPaymentFilters = {
  booking: "",
  request: "",
  status: "",
  method: "",
  currency: "",
  from: "",
  to: "",
  min: "",
  max: "",
  repair: "",
  q: "",
};
export type PaymentListFilters = typeof emptyPaymentFilters;
const choices: Partial<Record<keyof PaymentListFilters, string[]>> = {
  booking: ["without", "with", "unavailable"],
  request: ["without", "with"],
  status: ["completed", "pending", "failed", "refunded"],
  repair: ["yes"],
};
export const paymentRecordId = (value: any): string =>
  typeof value === "string"
    ? value.trim()
    : String(value?._id || value?.id || "");
export function readPaymentFilters(
  params: URLSearchParams,
): PaymentListFilters {
  return Object.fromEntries(
    Object.keys(emptyPaymentFilters).map((key) => {
      const value = params.get(key) || "";
      const allowed = choices[key as keyof PaymentListFilters];
      return [key, allowed && !allowed.includes(value) ? "" : value];
    }),
  ) as PaymentListFilters;
}
const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
export function paymentFilterError(f: PaymentListFilters): string {
  if ((f.from && !validDay(f.from)) || (f.to && !validDay(f.to)))
    return "Enter valid payment dates.";
  if (f.from && f.to && f.from > f.to)
    return "Payment date from must not be after date to.";
  for (const key of ["min", "max"] as const)
    if (
      f[key] &&
      (!/^\d+(\.\d{1,2})?$/.test(f[key]) || !Number.isFinite(Number(f[key])))
    )
      return "Enter non-negative amounts with at most two decimal places.";
  if (f.min && f.max && Number(f.min) > Number(f.max))
    return "Minimum amount must not exceed maximum amount.";
  return "";
}
export function paymentMatchesFilters(
  payment: any,
  f: PaymentListFilters,
): boolean {
  const booking = paymentRecordId(payment.bookingId),
    request = paymentRecordId(payment.paymentRequestId);
  if (
    (f.booking === "without" && booking) ||
    (f.booking === "with" && !booking) ||
    (f.booking === "unavailable" && (!booking || payment.bookingAvailable))
  )
    return false;
  if (
    (f.request === "without" && request) ||
    (f.request === "with" && !request)
  )
    return false;
  if (
    (f.status && payment.status !== f.status) ||
    (f.method && payment.paymentMethod !== f.method) ||
    (f.currency && payment.currency !== f.currency)
  )
    return false;
  if (
    f.repair === "yes" &&
    !payment.requestLinkPending &&
    !payment.relationshipChangePending
  )
    return false;
  const date = new Date(payment.paymentDate),
    day = Number.isFinite(date.getTime())
      ? date.toISOString().slice(0, 10)
      : "";
  if (
    (f.from || f.to) &&
    (!day || (f.from && day < f.from) || (f.to && day > f.to))
  )
    return false;
  const amount = Number(payment.amount);
  if (
    (f.min || f.max) &&
    (!Number.isFinite(amount) ||
      (f.min && amount < Number(f.min)) ||
      (f.max && amount > Number(f.max)))
  )
    return false;
  return true;
}
export function paymentConfirmationPath(
  bookingId: string,
  returnPayments: string,
) {
  return `/admin/bookings/${encodeURIComponent(bookingId)}?confirmation=1&returnPayments=${encodeURIComponent(returnPayments)}`;
}
export function safePaymentReturn(
  value: string | null,
  prefix: string,
  origin: string,
): string {
  try {
    const target = new URL(value || `${prefix}/payments`, origin);
    if (target.origin === origin && target.pathname === `${prefix}/payments`)
      return target.pathname + target.search;
  } catch {
    /* Invalid or foreign return links cannot leave this workspace. */
  }
  return `${prefix}/payments`;
}
