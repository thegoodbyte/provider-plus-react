import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicalReviewFollowUpButton from './MedicalReviewFollowUpButton';
import { medicalReviewRequestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { setFollowUp: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
const request: any = { _id: 'mrr', display_id: 7911, status: 'approved', followUpRequired: false };
beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
});
it.each([false, true])('saves the explicit flag from %s without changing the review status', async flagged => {
  (medicalReviewRequestsApi.setFollowUp as jest.Mock).mockResolvedValue({ data: { followUpRequired: !flagged } });
  const saved = jest.fn();
  render(<MedicalReviewFollowUpButton request={{ ...request, followUpRequired: flagged }} onSaved={saved} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(saved).toHaveBeenCalledWith({ followUpRequired: !flagged }));
  expect(medicalReviewRequestsApi.setFollowUp).toHaveBeenCalledWith('mrr', !flagged);
});
it('retains the flag and supports retry after a failed save', async () => {
  (medicalReviewRequestsApi.setFollowUp as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { followUpRequired: true } });
  const saved = jest.fn();
  render(<MedicalReviewFollowUpButton request={request} onSaved={saved} />);
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(saved).toHaveBeenCalledWith({ followUpRequired: true }));
});
it.each(['user', 'medical_advisor', 'facilitator'])('hides mutation for %s', role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role } });
  render(<MedicalReviewFollowUpButton request={request} onSaved={jest.fn()} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
