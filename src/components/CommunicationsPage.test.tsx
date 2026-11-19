import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunicationsPage from './CommunicationsPage';
import { communicationsApi, clientsApi, retreatsApi, bookingFlowApi, contractGateApi } from '../services/api';

jest.mock('../services/api', () => ({
  communicationsApi: {
    getSettings: jest.fn(), getTemplates: jest.fn(), getSentEmails: jest.fn(), getInboundEmails: jest.fn(),
    getTemplateSeedOptions: jest.fn(), getAssets: jest.fn(), getNextTemplateDisplayId: jest.fn(),
  },
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  bookingFlowApi: { getLibraryTemplates: jest.fn() },
  contractGateApi: { getSettings: jest.fn() },
}));
jest.mock('./EmailSafetySettings', () => () => <div>Email safety settings</div>);
jest.mock('./MedicalDecisionTemplateEditors', () => () => <div>Medical decision templates</div>);

const mock = (fn: unknown) => fn as jest.Mock;

// PPVC-1005: this page previously hand-rolled every button and card wrapper with no
// shared styling -- it had zero tests before this change.
describe('CommunicationsPage (PPVC-1005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(communicationsApi.getSettings).mockResolvedValue({ data: { fromName: 'Iboga Spirit', fromEmail: 'noreply@example.test' } });
    mock(communicationsApi.getTemplates).mockResolvedValue({ data: [] });
    mock(communicationsApi.getSentEmails).mockResolvedValue({ data: [] });
    mock(communicationsApi.getInboundEmails).mockResolvedValue({ data: [] });
    mock(communicationsApi.getTemplateSeedOptions).mockResolvedValue({ data: [] });
    mock(communicationsApi.getAssets).mockResolvedValue({ data: [] });
    mock(clientsApi.getAll).mockResolvedValue({ data: [] });
    mock(retreatsApi.getAll).mockResolvedValue({ data: [] });
    mock(bookingFlowApi.getLibraryTemplates).mockResolvedValue({ data: [] });
    mock(contractGateApi.getSettings).mockResolvedValue({ data: { enabled: true, preContractModules: [], portalAccessByStatus: {}, portalModuleCatalog: [], portalStatusCatalog: [], portalAccessModes: [] } });
  });

  const renderPage = () => render(<MemoryRouter><CommunicationsPage /></MemoryRouter>);

  it('renders the tab bar and each settings/tab section inside the shared Card surface', async () => {
    const { container } = renderPage();
    await screen.findByText('Communications');
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument();
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });

  it('switches to the Inbound tab and shows the shared Table/EmptyState-style empty row', async () => {
    renderPage();
    await screen.findByText('Communications');
    fireEvent.click(screen.getByRole('button', { name: 'Inbound' }));
    expect(await screen.findByText('No inbound emails stored yet.')).toBeInTheDocument();
  });

  it('switches settings areas via the shared AppleButton toggle', async () => {
    renderPage();
    await screen.findByText('Communications');
    fireEvent.click(screen.getByRole('button', { name: 'Sender & Gmail' }));
    expect(await screen.findByRole('button', { name: 'Connect Gmail' })).toBeInTheDocument();
  });
});
