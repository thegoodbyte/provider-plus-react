import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import { medicalReviewRequestsApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/api', () => ({
  medicalArtifactsApi: {},
  medicalReviewRequestsApi: { getAll: jest.fn(), getQueue: jest.fn(), getContext: jest.fn(), getAccessLinks: jest.fn(), getClientMessages: jest.fn() },
  usersApi: { findAll: jest.fn() },
}));

it.each(['admin', 'medical_advisor'])('renders saved translated messages at the bottom of the MRR for %s outside hidden legacy layouts', async role => {
  const request: any = { _id: 'mrr-1325', display_id: 1325, requestType: 'medications_review', status: 'pending', clientId: { _id: 'client-1', firstName: 'Test', lastName: 'Client' }, artifactIds: [] };
  (useAuth as jest.Mock).mockReturnValue({ user: { role, email: 'staff@example.com' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getQueue as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: [{ _id: 'saved-email', subject: 'Translated client message', bodyText: 'Proszę przesłać nowe zdjęcie.', to: ['client@example.com'], status: 'sent' }] });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [] });
  const route = role === 'admin' ? '/admin/medical-review-requests' : '/medical/review-requests';
  render(<MemoryRouter initialEntries={[`${route}/mrr-1325`]}><Routes><Route path={`${route}/:id`} element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Proszę przesłać nowe zdjęcie.')).toBeInTheDocument();
  const history = screen.getByRole('region', { name: 'Client message history' });
  expect(history.closest('.mrr-desktop-legacy')).toBeNull();
  expect(history.closest('.md\\:hidden')).toBeNull();
});
