import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientDetailsPage from './ClientDetailsPage';
import { clientsApi, clientMedicalApi, bookingsApi, paymentsApi, paymentRequestsApi, retreatsApi, medicalArtifactsApi, medicalReviewRequestsApi, api } from '../services/api';
import { taskService } from '../services/taskService';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
jest.mock('../services/api', () => ({
  clientsApi: { getOne: jest.fn(), getProfilePictureBlob: jest.fn() },
  clientMedicalApi: { getByClient: jest.fn() },
  bookingsApi: { getByClient: jest.fn() },
  paymentsApi: { getByClient: jest.fn() },
  paymentRequestsApi: { getByClient: jest.fn() },
  retreatsApi: { getAll: jest.fn(), getHeroImageUrl: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: { getByArtifacts: jest.fn() },
  api: { get: jest.fn() },
}));
jest.mock('../services/taskService', () => ({ taskService: { getTasks: jest.fn() } }));

const client = {
  _id: 'c1', display_id: 1120, firstName: 'Ada', lastName: 'Fixture', status: 'active', workflowStatus: 'screened_accepted',
  email: 'ada@example.test', phone: '+420777123456', country: 'Czech Republic', loginPin: '4821', priority: 'medium',
};

// PPVC-1003: the page header already shows status (via getStatusBadge(workflowStatus || status))
// -- the Overview tab must not repeat that same fact in its own "Status" row, only the more
// specific "Workflow Status".
describe('ClientDetailsPage Overview tab (PPVC-1003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: client });
    (clientMedicalApi.getByClient as jest.Mock).mockResolvedValue({ data: null });
    (bookingsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (paymentRequestsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (medicalReviewRequestsApi.getByArtifacts as jest.Mock).mockResolvedValue({ data: [] });
    (api.get as jest.Mock).mockResolvedValue({ data: { count: 0 } });
    (taskService.getTasks as jest.Mock).mockResolvedValue([]);
  });

  const renderPage = () => render(
    <MemoryRouter initialEntries={['/admin/clients/c1']}>
      <Routes><Route path="/admin/clients/:clientId" element={<ClientDetailsPage />} /></Routes>
    </MemoryRouter>,
  );

  it('shows the client name in the header, and does not repeat the Status field in the Overview tab (only the more specific Workflow Status)', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Ada Fixture' })).toBeInTheDocument();

    // The header shows one status badge (workflowStatus takes priority over status).
    const header = screen.getByRole('heading', { name: 'Ada Fixture' }).closest('div')!.parentElement!;
    expect(within(header).getByText('screened_accepted')).toBeInTheDocument();

    // The Overview tab's "Status & Dates" column must have a Workflow Status row, but no separate "Status" row --
    // that fact is already shown once, in the header above.
    const workflowLabel = await screen.findByText('Workflow Status:');
    const statusColumn = workflowLabel.closest('dl')!;
    expect(within(statusColumn).queryByText('Status:')).not.toBeInTheDocument();
    expect(within(statusColumn).getByText('Workflow Status:')).toBeInTheDocument();
  });

  it('renders the tab content inside the shared Card surface', async () => {
    const { container } = renderPage();
    await screen.findByText('Personal Information');
    expect(container.querySelector('.border-apple-gray-200.shadow-apple-sm')).toBeInTheDocument();
  });

  it('shows an EmptyState, not a raw empty div, when the Tasks tab has no tasks', async () => {
    renderPage();
    await screen.findByText('Personal Information');
    const tasksTab = screen.getByRole('button', { name: /Tasks/ });
    tasksTab.click();
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('Add a task to keep track of client-related activities.')).toBeInTheDocument();
  });
});
