import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MedicalReviewRequestEditorPage from './MedicalReviewRequestEditorPage';
import { clientsApi, communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi, medicalTrackingApi, retreatsApi } from '../services/api';
import { usersApi } from '../services/usersApi';

let mockUser: any = { role: 'admin' };
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../services/api', () => ({
  medicalTrackingApi: { getAll: jest.fn() },
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  medicalArtifactsApi: { getOne: jest.fn(), getAll: jest.fn() },
  medicalReviewRequestsApi: { getGroups: jest.fn(), getNextDisplayId: jest.fn(), getRequestTypes: jest.fn(), getOne: jest.fn(), downloadForWhatsapp: jest.fn() },
  communicationsApi: { getSettings: jest.fn() },
}));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn() } }));

const record: any = {
  _id: 'mrr-1', display_id: 5001, status: 'pending', requestType: 'ekg_review',
  medicalTrackingId: '', clientId: 'client-1', retreatId: '', artifactIds: [],
};

beforeEach(() => {
  mockUser = { role: 'admin' };
  jest.clearAllMocks();
  (medicalTrackingApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'client-1', firstName: 'Test', lastName: 'Client' }] });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getGroups as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getNextDisplayId as jest.Mock).mockResolvedValue({ data: 5001 });
  (usersApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getRequestTypes as jest.Mock).mockResolvedValue({ data: [{ key: 'ekg_review', label: 'EKG review' }] });
  (communicationsApi.getSettings as jest.Mock).mockResolvedValue({ data: {} });
  (medicalReviewRequestsApi.getOne as jest.Mock).mockResolvedValue({ data: record });
  (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
});

const mountEdit = () => render(
  <MemoryRouter initialEntries={['/admin/medical-review-requests/mrr-1']}>
    <Routes><Route path="/admin/medical-review-requests/:id" element={<MedicalReviewRequestEditorPage />} /></Routes>
  </MemoryRouter>,
);

it('shows a Download for WhatsApp button for an admin editing an existing request, and triggers the download', async () => {
  (medicalReviewRequestsApi.downloadForWhatsapp as jest.Mock).mockResolvedValue({ data: { url: 'https://cdn.example/mrr-5001.zip', fileName: 'mrr-5001.zip', fileCount: 1 } });
  const assign = jest.fn();
  const originalLocation = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });

  mountEdit();
  const button = await screen.findByRole('button', { name: 'Download MRR #5001 for WhatsApp' });
  fireEvent.click(button);

  await waitFor(() => expect(medicalReviewRequestsApi.downloadForWhatsapp).toHaveBeenCalledWith('mrr-1'));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://cdn.example/mrr-5001.zip'));

  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

it('hides the Download for WhatsApp button when creating a new request (no id yet)', async () => {
  render(
    <MemoryRouter initialEntries={['/admin/medical-review-requests/new']}>
      <Routes><Route path="/admin/medical-review-requests/new" element={<MedicalReviewRequestEditorPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Add Medical Review Request' });
  expect(screen.queryByText('Download for WhatsApp')).not.toBeInTheDocument();
});

it('hides the Download for WhatsApp button for roles that cannot manage requests', async () => {
  mockUser = { role: 'medical_advisor' };
  mountEdit();
  await screen.findByRole('heading', { name: 'Edit Medical Review Request' });
  expect(screen.queryByText('Download for WhatsApp')).not.toBeInTheDocument();
});
