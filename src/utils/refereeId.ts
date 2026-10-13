export function normalizeRefereeName(value?: string): string {
  if (!value) return '';
  return value
    .replace(/[łŁ]/g, 'l')
    .replace(/[ß]/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function formatRefereeId(params: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  retreatCode?: string;
  bookingNumber?: string | number;
}): string {
  const first = normalizeRefereeName(params.firstName) || 'client';
  const lastRaw = (params.lastName || '').trim().replace(/[łŁ]/g, 'l');
  const lastInitial = lastRaw
    ? lastRaw.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    : 'X';

  const rawPhone = String(params.phone || '').replace(/\D/g, '');
  const phone = rawPhone || 'nophone';

  const retreat = (params.retreatCode || 'RETREAT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const booking = String(params.bookingNumber || '').trim() || '0000';

  return `${first}.${lastInitial}-${phone}_${retreat}-${booking}`;
}
