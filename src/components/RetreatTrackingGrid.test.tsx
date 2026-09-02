import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatTrackingGrid from './RetreatTrackingGrid';
import { bookingsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getByRetreatWithDetails: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: { getAll: jest.fn(), getByArtifacts: jest.fn() },
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

  it('opens and exits the medical grid full-screen view', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1']}><RetreatTrackingGrid retreatId="retreat-1" /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Full screen' });

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(container.querySelector('.retreat-medical-grid')).toHaveClass('medical-grid-fullscreen');
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.retreat-medical-grid')).not.toHaveClass('medical-grid-fullscreen');
  });
});
