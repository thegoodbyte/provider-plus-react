type CeremonyReference = {
  _id?: string;
  id?: string;
  ceremonyNumber?: number;
  date?: string | Date;
  startTime?: string;
};

const idOf = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';

export const orderRetreatCeremonies = (ceremonies: CeremonyReference[]) =>
  Array.from(new Map(ceremonies.filter(Boolean).map((item) => [idOf(item) || String(item.ceremonyNumber), item])).values())
    .sort((a, b) => {
      const dateDifference = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      if (dateDifference) return dateDifference;
      const timeDifference = String(a.startTime || '').localeCompare(String(b.startTime || ''));
      if (timeDifference) return timeDifference;
      return Number(a.ceremonyNumber || 0) - Number(b.ceremonyNumber || 0);
    });

export const getRetreatCeremonyPosition = (
  ceremonies: CeremonyReference[],
  ceremonyId?: unknown,
  ceremonyNumber?: unknown,
) => {
  const ordered = orderRetreatCeremonies(ceremonies);
  const referenceId = idOf(ceremonyId);
  const rawNumber = Number(ceremonyNumber || 0);
  let index = referenceId ? ordered.findIndex((item) => idOf(item) === referenceId) : -1;
  if (index < 0) {
    index = ordered.findIndex((item) => rawNumber > 0 && Number(item.ceremonyNumber || 0) === rawNumber);
  }
  if (index >= 0) return index + 1;
  // Older artifacts stored the retreat-relative position directly.
  if (rawNumber > 0 && rawNumber <= Math.max(ordered.length, 2)) return rawNumber;
  return rawNumber;
};
