import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicalReviewClientMessages from './MedicalReviewClientMessages';
import { medicalReviewRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { getClientMessages: jest.fn() } }));
const getMessages = medicalReviewRequestsApi.getClientMessages as jest.Mock;
const translated = { _id: 'email-1', subject: 'Prosimy o nowe zdjęcie', bodyText: 'Proszę przesłać nowe zdjęcie EKG.', to: ['client@example.com'], status: 'sent', sentAt: '2026-10-05T12:00:00Z', createdBy: 'admin@example.com', variablesSnapshot: { language: 'pl', review: { message: 'Please upload a new EKG photo.' } } };

it('shows the actual translated email alongside its original source and send metadata', async () => {
  getMessages.mockResolvedValue({ data: [translated] });
  render(<MedicalReviewClientMessages requestId="mrr-1325" />);
  expect(await screen.findByText(translated.bodyText)).toBeInTheDocument();
  expect(screen.getByText('Client message history (1)')).toBeInTheDocument();
  expect(screen.getByText('Language: Polish')).toBeInTheDocument();
  expect(screen.getByText('Sent by: admin@example.com')).toBeInTheDocument();
  expect(screen.getByText(/To: client@example.com/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Original custom message'));
  expect(screen.getByText('Please upload a new EKG photo.')).toBeInTheDocument();
  expect(getMessages).toHaveBeenCalledWith('mrr-1325');
});

it('refreshes after a send and distinguishes failed and redirected emails from client delivery', async () => {
  getMessages.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [
    { ...translated, _id: 'failed', status: 'failed', errorMessage: 'Delivery failed', sentAt: undefined },
    { ...translated, _id: 'test', safetyRedirected: true, to: ['test@example.com'], intendedRecipients: { to: ['client@example.com'] } },
  ] });
  const { rerender } = render(<MedicalReviewClientMessages requestId="mrr-1325" refreshKey={0} />);
  expect(await screen.findByText('No client emails recorded for this MRR.')).toBeInTheDocument();
  rerender(<MedicalReviewClientMessages requestId="mrr-1325" refreshKey={1} />);
  expect(await screen.findByText('Failed')).toBeInTheDocument();
  expect(screen.getByText('Delivery failed')).toBeInTheDocument();
  expect(screen.getByText('Sent to test recipient')).toBeInTheDocument();
  expect(screen.getByText(/not delivered to the client/)).toBeInTheDocument();
});

it('reports load failure instead of an empty history and allows retry', async () => {
  getMessages.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ data: [translated] });
  render(<MedicalReviewClientMessages requestId="mrr-1325" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load client message history');
  expect(screen.queryByText('No client emails recorded for this MRR.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText(translated.bodyText)).toBeInTheDocument();
});

it('does not display a previous MRR response after switching requests', async () => {
  let resolvePrevious: (response: any) => void = () => {};
  getMessages.mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }))
    .mockResolvedValueOnce({ data: [{ ...translated, bodyText: 'Current MRR message' }] });
  const { rerender } = render(<MedicalReviewClientMessages requestId="previous-mrr" />);
  rerender(<MedicalReviewClientMessages requestId="current-mrr" />);
  expect(await screen.findByText('Current MRR message')).toBeInTheDocument();
  resolvePrevious({ data: [translated] });
  await waitFor(() => expect(screen.queryByText(translated.bodyText)).not.toBeInTheDocument());
});
