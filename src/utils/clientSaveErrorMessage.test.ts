import { clientSaveErrorMessage } from './clientSaveErrorMessage';

it.each([400, 409])('simplifies duplicate email responses (%s)', status => {
  expect(clientSaveErrorMessage({ response: { status, data: { message: 'Email taken@example.invalid is already registered. Please use a different email address.' } } })).toBe('Duplicate email');
});
it('supports validation message arrays', () => {
  expect(clientSaveErrorMessage({ response: { status: 400, data: { message: ['Duplicate email'] } } })).toBe('Duplicate email');
});
it.each([
  [400, 'Phone is already registered.'],
  [400, 'Email must be valid.'],
  [503, 'Email service is unavailable.'],
  [500, 'Duplicate email index is unavailable.'],
])('retains other server errors (%s, %s)', (status, message) => {
  expect(clientSaveErrorMessage({ response: { status, data: { message } } })).toBe(message);
});
it('provides fallback feedback', () => {
  expect(clientSaveErrorMessage({})).toBe('Failed to save client. Please try again.');
});
