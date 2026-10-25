import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import { medicalReviewRequestsApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/api', () => ({
  medicalArtifactsApi: {},
  medicalReviewRequestsApi: { update: jest.fn(), getAll: jest.fn(), getQueue: jest.fn(), getContext: jest.fn(), getAccessLinks: jest.fn(), getClientMessages: jest.fn() },
  usersApi: { findAll: jest.fn() },
}));

it.each(['admin', 'medical_advisor'])('renders saved translated messages at the bottom of the MRR for %s outside hidden legacy layouts', async role => {
  const request: any = { _id: 'mrr-1325', display_id: 1325, requestType: 'medications_review', status: 'pending', clientId: { _id: 'client-1', firstName: 'Test', lastName: 'Client', display_id: 1201 }, artifactIds: [] };
  (useAuth as jest.Mock).mockReturnValue({ user: { role, email: 'staff@example.com' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getQueue as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: { messages: [{ _id: 'saved-email', subject: 'Translated client message', bodyText: 'Proszę przesłać nowe zdjęcie.', to: ['client@example.com'], status: 'sent' }], skippedNotifications: [] } });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [] });
  const route = role === 'admin' ? '/admin/medical-review-requests' : '/medical/review-requests';
  render(<MemoryRouter initialEntries={[`${route}/mrr-1325`]}><Routes><Route path={`${route}/:id`} element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Proszę przesłać nowe zdjęcie.')).toBeInTheDocument();
  expect(screen.getByText('Client ID: 1201')).toBeInTheDocument();
  expect(screen.queryByText('ID: client-1')).not.toBeInTheDocument();
  const history = screen.getByRole('region', { name: 'Client message history' });
  expect(history.closest('.mrr-desktop-legacy')).toBeNull();
  expect(history.closest('.md\\:hidden')).toBeNull();
});


it('saves detailed WhatsApp results without the server-managed delivery field', async () => {
  const request: any = { _id: 'mrr', display_id: 1388, status: 'pending', requestType: 'ekg_review', assignedToUserId: 'advisor', clientId: { _id: 'client', firstName: 'Test', lastName: 'Client' }, artifactIds: [] };
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin', email: 'staff@example.invalid' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: { messages: [], skippedNotifications: [] } });
  (medicalReviewRequestsApi.update as jest.Mock).mockResolvedValue({ data: request });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'advisor', role: 'medical_advisor', firstName: 'Test', lastName: 'Advisor' }] });
  render(<MemoryRouter initialEntries={['/admin/medical-review-requests/mrr']}><Routes><Route path='/admin/medical-review-requests/:id' element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByLabelText('Handle this review via WhatsApp'));
  fireEvent.change(screen.getByLabelText('Medical advisor'), { target: { value: 'advisor' } });
  fireEvent.change(screen.getByLabelText('Date sent'), { target: { value: '2026-10-13' } });
  fireEvent.change(screen.getByLabelText('WhatsApp status'), { target: { value: 'responded' } });
  fireEvent.change(screen.getByLabelText('Date approved/answered'), { target: { value: '2026-10-14' } });
  fireEvent.change(screen.getByLabelText('Advisor result'), { target: { value: 'OK' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save WhatsApp status' }));
  await waitFor(() => expect(medicalReviewRequestsApi.update).toHaveBeenCalledWith('mrr', expect.objectContaining({ whatsappStatus: 'responded', whatsappDecision: 'OK', status: 'approved' })));
  expect((medicalReviewRequestsApi.update as jest.Mock).mock.calls.at(-1)[1]).not.toHaveProperty('advisorDeliveryStatus');
});

it('shows readable MRR identity using context when clientId is unpopulated', async () => {
  const request: any = { _id: '6ab051d2ae5432b71f7a364', display_id: 1413, requestType: 'medications_review', documentType: 'Medications', documentStage: 'entry', status: 'pending', clientId: '6ab051d2ae5432b71f7a365', artifactIds: [] };
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin', email: 'staff@example.invalid' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { client: { _id: request.clientId, firstName: 'Ewa', lastName: 'Franus', display_id: 1265 }, artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: { messages: [] } });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<MemoryRouter initialEntries={['/admin/medical-review-requests/' + request._id]}><Routes><Route path="/admin/medical-review-requests/:id" element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Medical Review MRR #1413' })).toBeInTheDocument();
  const identity = screen.getByRole('region', { name: 'Review identity' });
  expect(identity).toHaveTextContent('Ewa Franus');
  expect(identity).toHaveTextContent('Client ID: 1265');
  expect(identity).toHaveTextContent('Medications');
  expect(identity).not.toHaveTextContent(request.clientId);
});
