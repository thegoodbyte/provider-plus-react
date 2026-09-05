import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksForTodayPanel from './TasksForTodayPanel';
import { assistantApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  assistantApi: { getTasksForToday: jest.fn() },
}));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const view = () => render(<MemoryRouter><TasksForTodayPanel /></MemoryRouter>);

describe('TasksForTodayPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
  });

  it('renders nothing for a role without assistant access', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'user' } });
    const { container } = view();
    expect(assistantApi.getTasksForToday).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the soonest retreats and the highest-priority tasks', async () => {
    (assistantApi.getTasksForToday as jest.Mock).mockResolvedValue({
      data: {
        generatedAt: '2026-09-05T00:00:00.000Z',
        retreats: [
          { id: 'retreat-1', name: 'AAA-01', daysUntilRetreat: 5, link: '/admin/retreats/retreat-1/holisticView', highRiskClients: 1, totalBookings: 2 },
          { id: 'retreat-2', name: 'BBB-02', daysUntilRetreat: 40, link: '/admin/retreats/retreat-2/holisticView', highRiskClients: 0, totalBookings: 1 },
        ],
        tasks: [
          { severity: 'high', category: 'medical', clientName: 'John Doe', clientLink: '/admin/clients/client-1', bookingLink: '/admin/bookings/booking-1', message: 'Medical records missing: Entry EKG received', retreatId: 'retreat-1', retreatName: 'AAA-01' },
        ],
      },
    });

    view();

    expect(await screen.findByText('Tasks for Today')).toBeInTheDocument();
    expect(screen.getAllByText(/AAA-01/).length).toBeGreaterThan(0);
    expect(screen.getByText(/BBB-02/)).toBeInTheDocument();
    expect(screen.getByText(/Medical records missing: Entry EKG received/)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows an all-caught-up state when there are no tasks', async () => {
    (assistantApi.getTasksForToday as jest.Mock).mockResolvedValue({
      data: { generatedAt: '2026-09-05T00:00:00.000Z', retreats: [], tasks: [] },
    });

    view();

    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});
