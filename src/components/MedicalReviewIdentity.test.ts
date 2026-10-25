import { getMedicalReviewClientName } from './MedicalReviewRequestsPage.helpers';
it('never treats an unpopulated client ID as a name', () => {
  expect(getMedicalReviewClientName({ clientId: '6ab051d2ae5432b71f7a365' } as any)).toBe('Client name unavailable');
});
it('uses full context and legacy name aliases', () => {
  expect(getMedicalReviewClientName({ clientId: 'client' } as any, { _id: 'client', fname: 'Ewa', lname: 'Franus' })).toBe('Ewa Franus');
});
it('rejects context belonging to a different client and preserves populated names', () => {
  expect(getMedicalReviewClientName({ clientId: { _id: 'correct', firstName: 'Correct', lastName: 'Person' } } as any, { _id: 'wrong', firstName: 'Wrong', lastName: 'Person' })).toBe('Correct Person');
});
