import { groupMatchesRetreat } from './MedicalReviewRequestEditorPage.helpers';

describe('groupMatchesRetreat', () => {
  it('matches a packet using its retreat id', () => {
    expect(groupMatchesRetreat(
      { _id: 'group-1', title: 'BEN packet', retreatId: 'retreat-1' } as any,
      'retreat-1',
      { _id: 'retreat-1', code: 'BEN-08-03-26' } as any,
    )).toBe(true);
  });

  it('falls back to a normalized retreat code from serialized packet data', () => {
    expect(groupMatchesRetreat(
      { _id: 'group-1', title: 'BEN packet', retreatName: 'BEN-08-03-26' } as any,
      'retreat-1',
      { _id: 'retreat-1', code: 'BEN-08-03-26' } as any,
    )).toBe(true);
  });

  it('does not match a packet for a different retreat', () => {
    expect(groupMatchesRetreat(
      { _id: 'group-2', title: 'Other packet', retreatId: 'retreat-2', retreatName: 'JNO-09-01-26' } as any,
      'retreat-1',
      { _id: 'retreat-1', code: 'BEN-08-03-26' } as any,
    )).toBe(false);
  });
});
