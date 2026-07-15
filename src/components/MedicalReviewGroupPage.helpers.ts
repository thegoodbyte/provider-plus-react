import { MedicalReviewGroup, MedicalReviewRequest } from '../types';

export const getClientName = (request: any) => {
  const client = request.clientId && typeof request.clientId === 'object' ? request.clientId : {};
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unknown client';
};

export const getRetreatLabel = (request: any) => {
  const retreat = request.retreatId && typeof request.retreatId === 'object' ? request.retreatId : {};
  return retreat.code || retreat.retreatCode || retreat.name || 'Unknown retreat';
};

export const getPacketRetreatLabel = (group: MedicalReviewGroup | null, request: MedicalReviewRequest) => {
  const retreatLabel = getRetreatLabel(request);
  return retreatLabel !== 'Unknown retreat' ? retreatLabel : (group?.retreatName || 'Unknown retreat');
};

export const isPendingReview = (request: MedicalReviewRequest) => request.status === 'pending' || request.status === 'in_review';

export const getRequestKey = (request: MedicalReviewRequest) => request._id || '';

type PacketSection = {
  key: string;
  title: string;
  subtitle?: string;
  requests: MedicalReviewRequest[];
};

export const buildPacketSections = (group: MedicalReviewGroup | null, requests: MedicalReviewRequest[]): PacketSection[] => {
  const byKey = new Map<string, MedicalReviewRequest[]>();
  for (const request of requests || []) {
    const retreatLabel = getPacketRetreatLabel(group, request);
    const ceremonyNumber = request.ceremonyNumber || (request as any).ceremonyNumber;
    const sectionKey = group?.groupType === 'ceremony'
      ? `ceremony:${ceremonyNumber || 'unknown'}`
      : `retreat:${retreatLabel}`;
    const bucket = byKey.get(sectionKey) || [];
    bucket.push(request);
    byKey.set(sectionKey, bucket);
  }

  return Array.from(byKey.entries())
    .map(([key, sectionRequests]) => {
      const sorted = [...sectionRequests].sort((a, b) => String(a.requestType || '').localeCompare(String(b.requestType || '')) || String(getClientName(a)).localeCompare(getClientName(b)));
      if (key.startsWith('ceremony:')) {
        const ceremony = key.split(':')[1];
        return {
          key,
          title: ceremony === 'unknown' ? 'Ceremony group' : `Ceremony #${ceremony}`,
          subtitle: `${sorted.length} request${sorted.length === 1 ? '' : 's'}`,
          requests: sorted,
        };
      }
      const retreatLabel = key.slice('retreat:'.length);
      return {
        key,
        title: retreatLabel,
        subtitle: `${sorted.length} request${sorted.length === 1 ? '' : 's'}`,
        requests: sorted,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
};
