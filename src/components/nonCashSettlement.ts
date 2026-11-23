export const nonCashValue = (
  quantity: string,
  unitValue: string,
): number | undefined => {
  const q = Number(quantity),
    v = Number(unitValue);
  if (
    !quantity.trim() ||
    !unitValue.trim() ||
    !Number.isFinite(q) ||
    !Number.isFinite(v) ||
    q <= 0 ||
    v <= 0 ||
    q > 1000000 ||
    v > 1000000000
  )
    return undefined;
  if (
    Math.abs(q * 1000 - Math.round(q * 1000)) > 0.000001 ||
    Math.abs(v * 100 - Math.round(v * 100)) > 0.000001
  )
    return undefined;
  const scaled = Math.round(q * 1000) * Math.round(v * 100);
  if (!Number.isSafeInteger(scaled)) return undefined;
  const amount = Math.round(scaled / 1000) / 100;
  return amount >= 0.01 ? amount : undefined;
};
const keyName = "ppvc.non-cash-submission.v1";
export function nonCashSubmissionKey(): string {
  try {
    const existing = sessionStorage.getItem(keyName);
    if (existing) return existing;
  } catch {
    /* The form's ref still protects a retry if browser storage is unavailable. */
  }
  const key = crypto.randomUUID();
  try {
    sessionStorage.setItem(keyName, key);
  } catch {
    /* Per-form retry protection remains available. */
  }
  return key;
}
export function clearNonCashSubmissionKey() {
  try {
    sessionStorage.removeItem(keyName);
  } catch {
    /* No persisted key. */
  }
}
