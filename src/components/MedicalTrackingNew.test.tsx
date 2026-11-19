import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MedicalTrackingNew from './MedicalTrackingNew';
import { api, clientsApi } from '../services/api';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
jest.mock('../services/api', () => ({ api: { get: jest.fn() }, clientsApi: { getAll: jest.fn() } }));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedClientsApi = clientsApi as jest.Mocked<typeof clientsApi>;

const item = (overrides: Record<string, any> = {}) => ({
  _id: 'one', type: 'EKG', date_received: '2026-01-02', medadvisor_review_result: 'OK', ...overrides,
});

describe('MedicalTrackingNew', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClientsApi.getAll.mockResolvedValue({ data: [] } as any);
  });

  it('renders type and review-result as shared Badges, and the stat tiles as Cards', async () => {
    mockedApi.get.mockResolvedValue({ data: [item(), item({ _id: 'two', type: 'Liver', medadvisor_review_result: 'caution' })] } as any);
    render(<MemoryRouter><MedicalTrackingNew /></MemoryRouter>);

    expect((await screen.findByText('Total Items')).closest('.rounded-apple-lg')).not.toBeNull();
    expect((await screen.findByText('EKG', { selector: 'span' })).closest('.rounded-full')).not.toBeNull();
    expect((await screen.findByText('OK', { selector: 'span' })).closest('.rounded-full')).not.toBeNull();
    expect((await screen.findByText('caution', { selector: 'span' })).closest('.rounded-full')).not.toBeNull();
  });

  it('renders an empty table without error when there are no items', async () => {
    mockedApi.get.mockResolvedValue({ data: [] } as any);
    render(<MemoryRouter><MedicalTrackingNew /></MemoryRouter>);
    expect(await screen.findByText('No medical tracking items found')).toBeInTheDocument();
  });
});
