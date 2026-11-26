import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicalReviewQuickAccessPage from './MedicalReviewQuickAccessPage';
import { medicalReviewRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({
  medicalReviewRequestsApi: {
    getQuickAccess: jest.fn(),
    submitQuickAccessDecision: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ reviewLabel: 'mrr-1245', token: 'synthetic-token' }),
}));

const api = medicalReviewRequestsApi as jest.Mocked<typeof medicalReviewRequestsApi>;

const request: any = {
  _id: 'request-1',
  display_id: 1245,
  requestType: 'liver_panel_review',
  clientId: { firstName: 'Ewa', lastName: 'Franus' },
  retreatId: { code: 'NOV-29' },
};
const artifacts: any = [
  { _id: 'artifact-1', title: 'Liver panel results', files: [{ fileName: 'liver.pdf', url: 'https://files.example.invalid/liver.pdf' }] },
];

describe('MedicalReviewQuickAccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the record and renders client, request type, retreat and documents', async () => {
    api.getQuickAccess.mockResolvedValue({ data: { request, artifacts } } as any);
    render(<MedicalReviewQuickAccessPage />);
    expect(await screen.findByText('Ewa Franus')).toBeInTheDocument();
    expect(screen.getByText('Liver Panel Review')).toBeInTheDocument();
    expect(screen.getByText('NOV-29')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open liver.pdf' })).toHaveAttribute('href', 'https://files.example.invalid/liver.pdf');
    expect(api.getQuickAccess).toHaveBeenCalledWith('1245', 'synthetic-token');
  });

  it('shows a generic error screen instead of the review form when the link is invalid', async () => {
    api.getQuickAccess.mockRejectedValue({ response: { status: 404, data: { message: 'Medical review link is invalid or expired' } } });
    render(<MedicalReviewQuickAccessPage />);
    expect(await screen.findByText("This link can't be opened")).toBeInTheDocument();
    expect(screen.getByText('Medical review link is invalid or expired')).toBeInTheDocument();
    expect(screen.queryByText('Submit review')).not.toBeInTheDocument();
  });

  it('keeps the submit button disabled until a decision is picked and the note is long enough', async () => {
    api.getQuickAccess.mockResolvedValue({ data: { request, artifacts: [] } } as any);
    render(<MedicalReviewQuickAccessPage />);
    const submit = await screen.findByRole('button', { name: 'Submit review' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Approved — clear to proceed' }));
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'A' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Looks fine' } });
    expect(submit).toBeEnabled();
  });

  it('submits the chosen decision and note, then shows the confirmation screen', async () => {
    api.getQuickAccess.mockResolvedValue({ data: { request, artifacts: [] } } as any);
    api.submitQuickAccessDecision.mockResolvedValue({ data: { ...request, reviewDecision: 'caution' } } as any);
    render(<MedicalReviewQuickAccessPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approved with caution' }));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Mild elevation, monitor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    await waitFor(() => expect(api.submitQuickAccessDecision).toHaveBeenCalledWith('1245', 'synthetic-token', { reviewDecision: 'caution', medicalStaffNotes: 'Mild elevation, monitor' }));
    expect(await screen.findByText('Thank you')).toBeInTheDocument();
    expect(screen.getByText('Your review has been recorded.')).toBeInTheDocument();
  });

  it('shows a distinct message when the link is no longer valid for the reviewer', async () => {
    api.getQuickAccess.mockResolvedValue({ data: { request, artifacts: [] } } as any);
    api.submitQuickAccessDecision.mockRejectedValue({ response: { status: 403, data: { message: 'Forbidden' } } });
    render(<MedicalReviewQuickAccessPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not safe to proceed' }));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Needs escalation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText(/no longer valid for the assigned reviewer/)).toBeInTheDocument();
    expect(screen.queryByText('Thank you')).not.toBeInTheDocument();
  });
});
