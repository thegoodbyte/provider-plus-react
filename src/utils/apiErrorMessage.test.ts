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
