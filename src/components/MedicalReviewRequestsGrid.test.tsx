import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MedicalReviewRequestsGrid from './MedicalReviewRequestsGrid';
import { medicalReviewRequestsApi, medicalTrackingApi, clientsApi, retreatsApi } from '../services/api';
import { usersApi } from '../services/usersApi';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
jest.mock('../services/api', () => ({
  medicalReviewRequestsApi: { getAll: jest.fn(), getGroups: jest.fn() },
  medicalTrackingApi: { getAll: jest.fn() }, clientsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() },
}));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn() } }));

beforeEach(() => {
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    { _id: 'waiting', display_id: 7901, status: 'awaiting_whatsapp', reviewChannel: 'whatsapp', whatsappStatus: 'awaiting_response', whatsappAdvisorUserId: 'advisor', assignedToUserId: 'other', retreatId: 'retreat', requestType: 'ekg_review' },
    { _id: 'approved', display_id: 7902, status: 'approved', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappDecision: 'OK', retreatId: 'retreat', requestType: 'liver_panel_review' },
    { _id: 'declined', display_id: 7903, status: 'rejected', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappDecision: 'NOT OK', retreatId: 'other-retreat', requestType: 'ekg_review' },
    { _id: 'internal', display_id: 7904, status: 'approved', reviewChannel: 'internal', requestType: 'ekg_review' },
  ] });
  (medicalReviewRequestsApi.getGroups as jest.Mock).mockResolvedValue({ data: [] });
  (medicalTrackingApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'retreat', retreatCode: 'TEST-790' }] });
  (usersApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'advisor', role: 'medical_advisor', firstName: 'Test', lastName: 'Advisor' }] });
});

async function openWhatsApp() {
  render(<MemoryRouter><MedicalReviewRequestsGrid /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'WhatsApp handled', exact: true }));
}

it('renders blue awaiting-answer counts and results while preserving green answered results', async () => {
  await openWhatsApp();
  for (const badge of [screen.getByText('Awaiting answer'), screen.getByText('1 awaiting answer')]) {
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    expect(badge).not.toHaveClass('bg-amber-100');
  }
  expect(screen.getByText('OK', { exact: true })).toHaveClass('bg-green-100', 'text-green-800');
  expect(screen.queryByText('#7904')).not.toBeInTheDocument();
});

it.each([['awaiting_whatsapp', '#7901'], ['approved', '#7902'], ['rejected', '#7903']])('filters WhatsApp rows and group counts by %s', async (status, visibleId) => {
  await openWhatsApp();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: status } });
  expect(screen.getByText(visibleId)).toBeInTheDocument();
  for (const id of ['#7901', '#7902', '#7903'].filter(id => id !== visibleId)) expect(screen.queryByText(id)).not.toBeInTheDocument();
  expect(screen.getByText('1 handled via WhatsApp')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
  expect(screen.getByText('#7901')).toBeInTheDocument();
  expect(screen.getByText('#7902')).toBeInTheDocument();
  expect(screen.getByText('#7903')).toBeInTheDocument();
});

it('combines status and type filters, hides empty groups and explains empty results', async () => {
  await openWhatsApp();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'approved' } });
  fireEvent.change(screen.getByDisplayValue('All types'), { target: { value: 'ekg' } });
  expect(screen.getByText('No WhatsApp-handled MRRs match the current filters.')).toBeInTheDocument();
  expect(screen.queryByText('TEST-790')).not.toBeInTheDocument();
});

it('uses the WhatsApp advisor and includes awaiting responses in Pending only', async () => {
  await openWhatsApp();
  fireEvent.click(screen.getByLabelText('Pending only'));
  fireEvent.change(screen.getByLabelText('Advisor'), { target: { value: 'advisor' } });
  expect(screen.getByText('#7901')).toBeInTheDocument();
  expect(screen.queryByText('#7902')).not.toBeInTheDocument();
  expect(screen.queryByText('#7903')).not.toBeInTheDocument();
});

it('keeps status filtering in All and Grouped views', async () => {
  render(<MemoryRouter><MedicalReviewRequestsGrid /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'approved' } });
  fireEvent.click(screen.getByRole('button', { name: /Potentials & unmatched/ }));
  expect(screen.getByText('#7902')).toBeInTheDocument();
  expect(screen.queryByText('#7901')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'All', exact: true }));
  expect(screen.getAllByText('#7902').length).toBeGreaterThan(0);
  expect(screen.queryByText('#7901')).not.toBeInTheDocument();
});
