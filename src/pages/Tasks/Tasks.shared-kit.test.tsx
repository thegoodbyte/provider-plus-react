jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Tasks } from './Tasks';
import { taskService } from '../../services/taskService';
import { bookingFlowApi } from '../../services/api';

jest.mock('../../services/taskService', () => ({
  taskService: {
    getTasks: jest.fn(),
    isOverdue: jest.fn(() => false),
  },
}));
jest.mock('../../services/api', () => ({ bookingFlowApi: { getItems: jest.fn() } }));
jest.mock('../../components/Tasks/ClientSupportInbox', () => () => <div data-testid="client-support-inbox" />);
jest.mock('../../components/Tasks/TaskForm', () => ({ TaskForm: () => <div data-testid="task-form" /> }));
jest.mock('../../components/Tasks/TaskFiltersPanel', () => ({ TaskFiltersPanel: () => <div data-testid="task-filters-panel" /> }));
jest.mock('../../components/Tasks/TasksCalendarView', () => () => <div data-testid="tasks-calendar-view" />);
jest.mock('../../components/Tasks/SprintBoard', () => ({ SprintBoard: () => <div data-testid="sprint-board" /> }));

const api = taskService as jest.Mocked<typeof taskService>;
const flowApi = bookingFlowApi as jest.Mocked<typeof bookingFlowApi>;

const makeTask = (overrides: Partial<any> = {}) => ({
  id: 'one', name: 'Upload EKG', description: '', type: 'client', urgency: 'high',
  status: 'pending', dueDate: undefined, tags: [], createdAt: '', updatedAt: '', ...overrides,
});

describe('Tasks page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getTasks.mockResolvedValue([
      makeTask({ id: 'pending', status: 'pending' }),
      makeTask({ id: 'in-progress', status: 'in_progress' }),
      makeTask({ id: 'completed', status: 'completed' }),
      makeTask({ id: 'urgent', urgency: 'urgent' }),
    ] as any);
    flowApi.getItems.mockResolvedValue({ data: [] } as any);
  });

  it('renders the summary stat tiles with correct counts once tasks load', async () => {
    render(<MemoryRouter><Tasks /></MemoryRouter>);
    expect(await screen.findByText('4')).toBeInTheDocument();
    const total = screen.getByText('Total').closest('.stat-item') as HTMLElement;
    expect(total).not.toBeNull();
    expect(screen.getByText('Pending').parentElement!.textContent).toContain('2');
    expect(screen.getByText('Urgent').parentElement!.textContent).toContain('1');
  });

  it('renders the create-task action as an AppleButton', async () => {
    render(<MemoryRouter><Tasks /></MemoryRouter>);
    await screen.findByText('4');
    expect(screen.getByRole('button', { name: /\+ Client task/ })).toBeInTheDocument();
  });

  it('renders the client-support inbox workspace instead of the grid when ?support is present', async () => {
    render(<MemoryRouter initialEntries={['/admin/tasks?support=all']}><Tasks /></MemoryRouter>);
    expect(await screen.findByTestId('client-support-inbox')).toBeInTheDocument();
    expect(api.getTasks).not.toHaveBeenCalled();
  });
});
