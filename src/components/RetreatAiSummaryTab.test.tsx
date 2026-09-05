import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatAiSummaryTab from './RetreatAiSummaryTab';
import { assistantApi } from '../services/api';

const view = () => render(<MemoryRouter><RetreatAiSummaryTab retreatId="retreat-1" /></MemoryRouter>);

jest.mock('../services/api', () => ({
  assistantApi: { analyzeRetreatReadiness: jest.fn() },
}));

const baseAnalysis = {
  generatedAt: '2026-08-01T00:00:00.000Z',
  generatedBy: 'rules' as const,
  retreat: { id: 'retreat-1', code: 'JNO-09-12-26', name: 'JNO-09-12-26', daysUntilRetreat: 12 },
  metrics: { totalBookings: 2, highRiskClients: 1 },
  findings: [],
  suggestedActions: [],
  clients: [
    {
      bookingId: 'booking-1', bookingNumber: 1300, bookingLink: '/admin/bookings/booking-1', clientName: 'John Doe', clientLink: '/admin/clients/client-1',
      ekgReceived: false, liverReceived: false, medicalReviewSent: false, medicalApproved: false, pendingMedicalReviews: 1,
      openBlockingSteps: 1, overdueSteps: 0, missingSteps: ['Entry EKG received'], balanceDue: 4000, bookingCurrency: 'EUR',
      isBehindOnEverything: true, nextAction: 'Resolve Entry EKG received', severity: 'high' as const,
    },
    {
      bookingId: 'booking-2', bookingNumber: 1301, bookingLink: '/admin/bookings/booking-2', clientName: 'Jane Smith', clientLink: '/admin/clients/client-2',
      ekgReceived: true, liverReceived: true, medicalReviewSent: true, medicalApproved: true, pendingMedicalReviews: 0,
      openBlockingSteps: 0, overdueSteps: 0, missingSteps: [], balanceDue: 0, bookingCurrency: 'EUR',
      isBehindOnEverything: false, nextAction: 'No medical blocker found', severity: 'low' as const,
    },
  ],
  tasks: [
    { severity: 'high' as const, category: 'medical' as const, clientName: 'John Doe', clientLink: '/admin/clients/client-1', bookingLink: '/admin/bookings/booking-1', message: 'Medical records missing: Entry EKG received' },
    { severity: 'high' as const, category: 'payment' as const, clientName: 'John Doe', clientLink: '/admin/clients/client-1', bookingLink: '/admin/bookings/booking-1', message: 'Payment due: 4,000 EUR' },
    { severity: 'medium' as const, category: 'review' as const, clientName: 'John Doe', clientLink: '/admin/clients/client-1', bookingLink: '/admin/bookings/booking-1', message: '1 medical review pending advisor sign-off' },
  ],
  summary: 'JNO-09-12-26: 2 active bookings, 1 high-risk client, 12 days until retreat.',
};

describe('RetreatAiSummaryTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assistantApi.analyzeRetreatReadiness as jest.Mock).mockResolvedValue({ data: baseAnalysis });
  });

  it('groups tasks by client and flags who is behind on everything', async () => {
    view();

    expect(await screen.findByText('AI Summary')).toBeInTheDocument();
    expect(assistantApi.analyzeRetreatReadiness).toHaveBeenCalledWith('retreat-1');
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/Behind on everything/i)).toBeInTheDocument();
    expect(screen.getByText(/Medical records missing: Entry EKG received/)).toBeInTheDocument();
    expect(screen.getByText(/Payment due: 4,000 EUR/)).toBeInTheDocument();
    expect(screen.getByText(/1 medical review pending advisor sign-off/)).toBeInTheDocument();
  });

  it('shows an all-clear state when there are no outstanding tasks', async () => {
    (assistantApi.analyzeRetreatReadiness as jest.Mock).mockResolvedValue({
      data: { ...baseAnalysis, tasks: [], clients: [baseAnalysis.clients[1]] },
    });

    view();

    expect(await screen.findByText(/nothing urgent/i)).toBeInTheDocument();
  });

  it('refreshes the analysis when the refresh button is clicked', async () => {
    view();
    await screen.findByText('AI Summary');

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(assistantApi.analyzeRetreatReadiness).toHaveBeenCalledTimes(2));
  });
});
