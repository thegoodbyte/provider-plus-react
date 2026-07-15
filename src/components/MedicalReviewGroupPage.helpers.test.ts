import { buildPacketSections, getPacketRetreatLabel, getClientName, getRetreatLabel, isPendingReview } from './MedicalReviewGroupPage.helpers';

describe('MedicalReviewGroupPage helpers', () => {
  it('groups retreat packets by retreat and sorts pending reviews by type then client', () => {
    const sections = buildPacketSections({
      groupType: 'retreat',
      retreatName: 'JNO-07-25-26',
    } as any, [
      {
        _id: 'review-2',
        status: 'pending',
        requestType: 'liver_panel_review',
        clientId: { firstName: 'Barbara', lastName: 'Peicher' },
        retreatId: { code: 'JNO-07-25-26' },
      },
      {
        _id: 'review-1',
        status: 'pending',
        requestType: 'ekg_review',
        clientId: { firstName: 'Jacek', lastName: 'Jacewicz' },
        retreatId: { code: 'JNO-07-25-26' },
      },
      {
        _id: 'review-3',
        status: 'approved',
        requestType: 'ekg_review',
        clientId: { firstName: 'Marta', lastName: 'Legezinska' },
        retreatId: { code: 'JNO-07-25-26' },
      },
    ] as any);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      key: 'retreat:JNO-07-25-26',
      title: 'JNO-07-25-26',
      subtitle: '3 requests',
    });
    expect(sections[0].requests.map((request) => request._id)).toEqual(['review-1', 'review-3', 'review-2']);
  });

  it('falls back to the group retreat name when the request has no retreat', () => {
    const group = { retreatName: 'Fallback Retreat', groupType: 'retreat' } as any;
    const request = { status: 'pending', clientId: { firstName: 'Marta', lastName: 'L.' } } as any;

    expect(getPacketRetreatLabel(group, request)).toBe('Fallback Retreat');
    expect(getClientName(request)).toBe('Marta L.');
    expect(getRetreatLabel(request)).toBe('Unknown retreat');
    expect(isPendingReview(request)).toBe(true);
  });

  it('creates ceremony buckets when the group is ceremony-based', () => {
    const sections = buildPacketSections({
      groupType: 'ceremony',
    } as any, [
      {
        _id: 'review-1',
        status: 'pending',
        ceremonyNumber: 2,
        requestType: 'ekg_review',
        clientId: { firstName: 'Marta', lastName: 'Legezinska' },
      },
      {
        _id: 'review-2',
        status: 'pending',
        ceremonyNumber: 2,
        requestType: 'blood_pressure_review',
        clientId: { firstName: 'Jacek', lastName: 'Jacewicz' },
      },
    ] as any);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      key: 'ceremony:2',
      title: 'Ceremony #2',
      subtitle: '2 requests',
    });
  });
});
