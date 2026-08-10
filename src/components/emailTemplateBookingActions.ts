export const normalizeTemplateBookingStepKeys = (
  bookingFlowStepKeys?: Array<string | null | undefined>,
  legacyBookingFlowStepKey?: string | null,
) => Array.from(new Set([
  ...(bookingFlowStepKeys || []),
  legacyBookingFlowStepKey,
].filter(Boolean).map((key) => String(key).trim()).filter(Boolean)));

export const buildTemplateBookingActionPayload = (
  bookingFlowStepKeys?: Array<string | null | undefined>,
  legacyBookingFlowStepKey?: string | null,
) => {
  const keys = normalizeTemplateBookingStepKeys(bookingFlowStepKeys, legacyBookingFlowStepKey);
  return {
    bookingFlowStepKey: keys[0] || undefined,
    bookingFlowStepKeys: keys,
  };
};
