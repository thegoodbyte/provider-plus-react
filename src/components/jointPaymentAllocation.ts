export const splitPaymentEvenly = (total: number, count: number) => {
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(count) || count < 1) return [];
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100);
};
