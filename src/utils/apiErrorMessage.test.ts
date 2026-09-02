import { apiErrorMessage } from './apiErrorMessage';

it('shows the actual API validation error instead of the Axios status message', () => {
  const error = {
    message: 'Request failed with status code 400',
    response: { data: { error: 'Bad Request', message: 'Booking #1196 must be selected.' } },
  };
  expect(apiErrorMessage(error, 'Could not save.')).toBe('Booking #1196 must be selected.');
});

it('combines nested validation messages returned by the API', () => {
  const error = {
    response: { data: { message: ['Amount must be greater than zero.', { message: 'Currency is required.' }] } },
  };
  expect(apiErrorMessage(error, 'Could not save.')).toBe('Amount must be greater than zero. · Currency is required.');
});
