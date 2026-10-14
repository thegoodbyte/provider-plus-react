import { apiErrorMessage } from './apiErrorMessage';

describe('apiErrorMessage', () => {
  it('shows all backend validation messages', () => {
    expect(apiErrorMessage({ response: { data: { message: ['Choose another retreat.', 'The retreat is full.'] } } }, 'Fallback'))
      .toBe('Choose another retreat. The retreat is full.');
  });

  it('falls back when the response has no useful message', () => {
    expect(apiErrorMessage({}, 'Unable to reschedule this booking.')).toBe('Unable to reschedule this booking.');
  });
});

it.each([400, 409])('normalizes duplicate email at %s', status => {
  expect(apiErrorMessage({ response: { status, data: { message: 'Email taken@example.invalid is already registered.' } } }, 'Could not save client.')).toBe('Duplicate email');
});
it.each([
 [403, 'Private internal role information', 'You do not have permission to perform this action.'],
 [429, 'Raw provider limit', 'Too many requests. Please wait a moment before continuing.'],
 [500, 'MongoServerError passwordHash=secret', 'Could not save client. The service is temporarily unavailable.'],
 [503, 'S3 bucket credentials', 'Could not save client. The service is temporarily unavailable.'],
 [400, 'Request failed with status code 400', 'Could not save client.'],
 [409, 'The retreat is full.', 'The retreat is full.'],
])('presents safe context for %s', (status, message, expected) => {
 expect(apiErrorMessage({ response: { status, data: { message } } }, 'Could not save client.')).toBe(expected);
});
it('does not expose Axios errors when the backend has no reason', () => {
 expect(apiErrorMessage({ message: 'Request failed with status code 400' }, 'Could not save client.')).toBe('Could not save client.');
});
it.each([['/communications/send', 'Email delivery could not be confirmed. Check sent messages before sending again.'], ['/payments', 'The payment update could not be confirmed. Check payment history before making another change.']])('requires verification of uncertain mutation %s', (url, expected) => {
 expect(apiErrorMessage({ request: {}, config: { method: 'post', url } }, 'Could not save.')).toBe(expected);
});
