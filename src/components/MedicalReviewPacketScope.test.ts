import { editablePacketRequests } from './MedicalReviewRequestsGrid.helpers';
const requests: any[] = [
  { _id: 'potential' }, { _id: 'other-retreat', retreatId: 'r2' },
  { _id: 'same-retreat', retreatId: { _id: 'r1' } }, { _id: 'other-packet' },
];
it('includes clients without a retreat and across retreats when no retreat is selected', () => {
  expect(editablePacketRequests(requests, [], new Set(['other-packet']), '').map(r => r._id)).toEqual(['potential', 'other-retreat', 'same-retreat']);
});
it('preserves current members while retaining a specific retreat filter for new members', () => {
  expect(editablePacketRequests(requests, ['potential'], new Set(['potential', 'other-packet']), 'r1').map(r => r._id)).toEqual(['potential', 'same-retreat']);
});
