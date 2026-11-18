import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MedicalAdvisorDashboard from './MedicalAdvisorDashboard';
import { medicalReviewRequestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  medicalReviewRequestsApi: { getQueue: jest.fn() },
}));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const mock = (fn: unknown) => fn as jest.Mock;

const requests = [
  { _id: 'r1', display_id: 101, status: 'pending', requestType: 'ekg', clientId: { firstName: 'Anna', lastName: 'Test' }, retreatId: { name: 'Spring Retreat' }, requestedAt: '2026-10-01T00:00:00Z' },
  { _id: 'r2', display_id: 102, status: 'approved', requestType: 'blood_pressure', clientId: { firstName: 'Ben', lastName: 'Example' }, retreatId: { name: 'Fall Retreat' }, requestedAt: '2026-10-02T00:00:00Z' },
];

// PPVC-1006: this page previously used an entirely bespoke MedicalAdvisorDashboard.css
// namespace (stat cards, filter tabs, review cards) with no shared kit usage at all.
describe('MedicalAdvisorDashboard (PPVC-1006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(medicalReviewRequestsApi.getQueue).mockResolvedValue({ data: requests });
    mock(useAuth).mockReturnValue({ user: { role: 'admin', firstName: 'Admin' } });
  });

  const renderPage = () => render(<MemoryRouter><MedicalAdvisorDashboard /></MemoryRouter>);

  it('shows stat tiles and the open review inside the shared Card surface', async () => {
    const { container } = renderPage();
    await screen.findByText('Anna Test');
    expect(screen.queryByText('Ben Example')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });

  it('filters the review list by clicking a stat tile', async () => {
    renderPage();
    await screen.findByText('Anna Test');
    fireEvent.click(screen.getByRole('button', { name: /Approved \/ OK/ }));
    await waitFor(() => expect(screen.queryByText('Anna Test')).not.toBeInTheDocument());
    expect(screen.getByText('Ben Example')).toBeInTheDocument();
  });

  it('refreshes the queue on demand', async () => {
    renderPage();
    await screen.findByText('Anna Test');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(medicalReviewRequestsApi.getQueue).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when no reviews match the current filter', async () => {
    mock(medicalReviewRequestsApi.getQueue).mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(/No medical review requests match this view\.|You are all caught up/)).toBeInTheDocument();
  });
});
