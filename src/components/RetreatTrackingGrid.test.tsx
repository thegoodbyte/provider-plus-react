import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatTrackingGrid from './RetreatTrackingGrid';
import { bookingFlowApi, bookingsApi, documentRequestsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getByRetreatWithDetails: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: { getAll: jest.fn(), getByArtifacts: jest.fn() },
  bookingFlowApi: { getItems: jest.fn() },
  documentRequestsApi: { requestMissingDocument: jest.fn() },
}));
jest.mock('antd', () => ({ Modal: ({ open, children }: any) => open ? <div>{children}</div> : null }));

describe('RetreatTrackingGrid MRR actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({ data: [{
      _id: 'booking-1', bookingNumber: 1248, status: 'confirmed',
      clientId: { _id: 'client-1', firstName: 'Agnieszka', lastName: 'Nowak', display_id: 1197 },
      retreatId: { _id: 'retreat-1', retreatCode: 'JNO-09-22-26' },
    }] });
    (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [
      { _id: 'artifact-ekg', display_id: 1152, bookingId: 'booking-1', clientId: 'client-1', artifactType: 'ekg', documentType: 'EKG' },
      { _id: 'artifact-liver', display_id: 1153, bookingId: 'booking-1', clientId: 'client-1', artifactType: 'liver_panel', documentType: 'Liver' },
    ] });
    (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [{
      _id: 'review-ekg', display_id: 1105, clientId: 'client-1', artifactIds: ['artifact-ekg'],
      requestType: 'ekg_review', status: 'pending',
    }] });
    (medicalReviewRequestsApi.getByArtifacts as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('shows the MRR number or a create action linked to the source artifact', async () => {
    render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1']}><RetreatTrackingGrid retreatId="retreat-1" /></MemoryRouter>);

    expect((await screen.findAllByRole('link', { name: 'MRR #1105' }))[0]).toHaveAttribute('href', '/admin/medical-review-requests/review-ekg');
    expect(screen.getAllByRole('link', { name: /Create MRR for Agnieszka Nowak liver/i })[0]).toHaveAttribute(
      'href',
      '/admin/medical-review-requests/new?artifactId=artifact-liver',
    );
    expect(screen.queryByText('Booking #1248')).not.toBeInTheDocument();
  });

  it('shows only the latest editable preparation plan for the correct booking in desktop and mobile grids', async () => {
    (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [
      { _id: 'old', bookingId: 'booking-1', title: 'Old instruction', status: 'pending', dueDate: '2026-10-01', metadata: { medicationStopPlan: true, planLifecycle: 'published', planVersion: 1 } },
      { _id: 'draft', bookingId: 'booking-1', title: 'Alcohol', status: 'pending', dueDate: '2026-10-17', metadata: { medicationStopPlan: true, planLifecycle: 'draft', planVersion: 2 } },
      { _id: 'other', bookingId: 'booking-2', title: 'Other client instruction', status: 'pending', metadata: { medicationStopPlan: true } },
    ] });
    render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1']}><RetreatTrackingGrid retreatId="retreat-1" /></MemoryRouter>);
    const links = await screen.findAllByRole('link', { name: 'Medical Preparation Calendar' });
    expect(links).toHaveLength(2);
    links.forEach(link => expect(link).toHaveAttribute('href', '/admin/bookings/booking-1/medication-stop-plan'));
    expect(screen.getAllByText('2026-10-17 · Alcohol')).toHaveLength(2);
    expect(screen.queryByText(/Old instruction|Other client instruction/)).not.toBeInTheDocument();
  });

  it('opens and exits the medical grid full-screen view', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1']}><RetreatTrackingGrid retreatId="retreat-1" /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Full screen' });

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(container.querySelector('.retreat-medical-grid')).toHaveClass('medical-grid-fullscreen');
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.retreat-medical-grid')).not.toHaveClass('medical-grid-fullscreen');
  });

  it('requests a missing document from the client and refreshes once sent (PPVC-687)', async () => {
    (documentRequestsApi.requestMissingDocument as jest.Mock).mockResolvedValue({ data: { emailSent: true, message: 'Client notified.' } });
    render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1']}><RetreatTrackingGrid retreatId="retreat-1" /></MemoryRouter>);

    const requestButtons = await screen.findAllByRole('button', { name: 'Request from client' });
    fireEvent.click(requestButtons[0]);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Client notified.'));
    expect(documentRequestsApi.requestMissingDocument).toHaveBeenCalledWith('booking-1', 'medications');
    await waitFor(() => expect(bookingFlowApi.getItems).toHaveBeenCalledTimes(2));
  });
});
