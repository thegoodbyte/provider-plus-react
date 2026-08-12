import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingMedicalUpload from './BookingMedicalUpload';
import { bookingFlowApi, bloodPressureReadingsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { usersApi } from '../services/usersApi';

jest.mock('../services/api', () => ({
  bookingFlowApi: { getItems: jest.fn() },
  bloodPressureReadingsApi: { getByClient: jest.fn(), update: jest.fn(), delete: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn(), create: jest.fn(), uploadFiles: jest.fn(), delete: jest.fn() },
  medicalReviewRequestsApi: { getByArtifact: jest.fn(), create: jest.fn() },
}));

jest.mock('../services/usersApi', () => ({
  usersApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
}));

describe('BookingMedicalUpload loading state', () => {
  it('does not show missing EKG or liver files while artifact requests are pending', async () => {
    let resolveArtifacts!: (value: any) => void;
    const pendingArtifacts = new Promise((resolve) => { resolveArtifacts = resolve; });

    (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [] });
    (bloodPressureReadingsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (usersApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (medicalArtifactsApi.getAll as jest.Mock).mockReturnValue(pendingArtifacts);
    (medicalReviewRequestsApi.getByArtifact as jest.Mock).mockResolvedValue({ data: [] });

    render(<MemoryRouter><BookingMedicalUpload bookingId="booking-1" bookingNumber="PP-100" clientId="client-1" retreatId="retreat-1" /></MemoryRouter>);

    expect(screen.getByText('Loading EKG files…')).toBeInTheDocument();
    expect(screen.getByText('Loading Liver Panel files…')).toBeInTheDocument();
    expect(screen.queryByText('No EKG file uploaded yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No Liver Panel file uploaded yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('missing artifact')).not.toBeInTheDocument();

    resolveArtifacts({
      data: [{
        _id: 'artifact-1',
        bookingId: 'booking-1',
        artifactType: 'ekg',
        documentType: 'EKG',
        documentStage: 'entry',
        title: 'Entry EKG',
        files: [{ fileName: 'entry-ekg.pdf', size: 1200 }],
      }],
    });

    await waitFor(() => expect(screen.getByText(/entry-ekg\.pdf/)).toBeInTheDocument());
    expect(screen.queryByText('Loading EKG files…')).not.toBeInTheDocument();
    expect(screen.getByText('No Liver Panel file uploaded yet.')).toBeInTheDocument();
  });
});
