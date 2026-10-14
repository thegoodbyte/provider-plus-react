import { apiErrorMessage } from './apiErrorMessage';

export const clientSaveErrorMessage = (error: any): string => {
  const message = apiErrorMessage(error, 'Failed to save client. Please try again.');
  const status = error?.response?.status;
  if ((status === 400 || status === 409) &&
      /\bemail\b.*\balready registered\b|\bduplicate email\b/i.test(message)) {
    return 'Duplicate email';
  }
  return message;
};
