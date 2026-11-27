import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Tasks } from './Tasks';
import { taskService } from '../../services/taskService';
import { bookingFlowApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../services/taskService', () => ({
  taskService: {
    getTasks: jest.fn(),
    isOverdue: jest.fn(() => false),
  },
}));
jest.mock('../../services/api', () => ({
  bookingFlowApi: { getItems: jest.fn() },
}));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const getTasks = taskService.getTasks as jest.Mock;
const getItems = bookingFlowApi.getItems as jest.Mock;

const makeTask = (overrides: any = {}) => ({
  id: 'one', name: 'Call back', description: '', type: 'client', urgency: 'medium', status: 'pending',
  tags: [], createdAt: '2026-08-29', updatedAt: '2026-08-29', clientId: { firstName: 'Eva', lastName: 'Novak', email: '' },
  ...overrides,
});

const renderTasks = () => render(<MemoryRouter><Tasks /></MemoryRouter>);

describe('Tasks page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTasks.mockResolvedValue([]);
    getItems.mockResolvedValue({ data: [] });
  });

  it('defaults non-admin staff (e.g. Kasia on customer care) to "My tasks" and requests mine=true (PPVC-1047)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'user' } });
    renderTasks();
    await waitFor(() => expect(getTasks).toHaveBeenCalled());
    expect(getTasks).toHaveBeenCalledWith(expect.objectContaining({ mine: true }));
    const myTasksButton = await screen.findByRole('button', { name: 'My tasks' });
    expect(myTasksButton).toHaveClass('active');
  });

  it('defaults admins to "All tasks" and omits mine from the request (PPVC-1047)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
    renderTasks();
    await waitFor(() => expect(getTasks).toHaveBeenCalled());
    expect(getTasks).toHaveBeenCalledWith(expect.objectContaining({ mine: undefined }));
    const allTasksButton = await screen.findByRole('button', { name: 'All tasks' });
    expect(allTasksButton).toHaveClass('active');
  });

  it('toggles between My tasks and All tasks, re-fetching with/without mine=true (PPVC-1047)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
    renderTasks();
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(1));
    expect(getTasks).toHaveBeenLastCalledWith(expect.objectContaining({ mine: undefined }));

    fireEvent.click(await screen.findByRole('button', { name: 'My tasks' }));
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2));
    expect(getTasks).toHaveBeenLastCalledWith(expect.objectContaining({ mine: true }));

    fireEvent.click(await screen.findByRole('button', { name: 'All tasks' }));
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(3));
    expect(getTasks).toHaveBeenLastCalledWith(expect.objectContaining({ mine: undefined }));
  });

  it('shows the populated assignee on a task row, and Unassigned when absent, without crashing (PPVC-1047)', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
    getTasks.mockResolvedValue([
      makeTask({
        id: 'assigned', name: 'Assigned task',
        assignedToUserId: { _id: 'user-1', firstName: 'Kasia', lastName: 'Nowak', email: 'kasia@example.com', role: 'user' },
      }),
      makeTask({ id: 'unassigned', name: 'Unassigned task' }),
    ]);
    renderTasks();
    expect(await screen.findByText('Assigned task')).toBeInTheDocument();
    expect(screen.getByText('Kasia Nowak')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Assignee for Unassigned task' })).toHaveDisplayValue('Unassigned');
  });
});
