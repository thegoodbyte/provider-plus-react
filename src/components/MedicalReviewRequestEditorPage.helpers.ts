import { MedicalReviewGroup, Retreat } from '../types';

const getObjectId = (value: string | { _id?: string; id?: string } | undefined | null) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const normalizeRetreatLabel = (value?: string | null) => String(value || '').trim().toLowerCase();

export const groupMatchesRetreat = (group: MedicalReviewGroup, retreatId: string, retreat?: Retreat | null) => {
  const groupRetreatId = getObjectId(group.retreatId as any);
  if (groupRetreatId && retreatId && groupRetreatId === retreatId) return true;
  const groupRetreatLabel = normalizeRetreatLabel(group.retreatName);
  if (!groupRetreatLabel || !retreat) return false;
  return [retreat.code, retreat.retreatCode, retreat.name]
    .map(normalizeRetreatLabel)
    .filter(Boolean)
    .includes(groupRetreatLabel);
};
