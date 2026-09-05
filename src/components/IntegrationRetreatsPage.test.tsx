import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IntegrationRetreatsPage from './IntegrationRetreatsPage';
import { integrationApi } from '../services/api';

jest.mock('../services/api', () => ({
  integrationApi: { listRetreats: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const view = () => render(<MemoryRouter><IntegrationRetreatsPage /></MemoryRouter>);

describe('IntegrationRetreatsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (integrationApi.listRetreats as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'retreat-1', name: 'BEN-05-30-26', startDate: '2026-05-30T00:00:00.000Z', endDate: '2026-06-06T00:00:00.000Z', totalClients: 3,
          checkpoints: [
            { checkpointNumber: 1, targetDate: '2026-06-13T00:00:00.000Z', reachedCount: 2, totalCount: 3 },
            { checkpointNumber: 2, targetDate: '2026-06-27T00:00:00.000Z', reachedCount: 0, totalCount: 3 },
            { checkpointNumber: 3, targetDate: '2026-07-11T00:00:00.000Z', reachedCount: 0, totalCount: 3 },
          ],
        },
      ],
    });
  });

  it('lists retreats with per-checkpoint reached counts and navigates on click', async () => {
    view();

    expect(await screen.findByText('BEN-05-30-26')).toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('BEN-05-30-26'));

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('retreat-1'));
  });

  it('shows an empty state when there are no retreats', async () => {
    (integrationApi.listRetreats as jest.Mock).mockResolvedValue({ data: [] });

    view();

    expect(await screen.findByText(/no retreats/i)).toBeInTheDocument();
  });
});
