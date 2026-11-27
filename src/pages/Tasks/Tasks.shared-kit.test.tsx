jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders truthful status counts and switches the visible scoped rows', async () => {
    render(<MemoryRouter><Tasks /></MemoryRouter>);
    expect(await screen.findByRole('tab', {name:'Open 3',exact:true})).toHaveAttribute('aria-selected','true');
    expect(screen.getByRole('tab',{name:'Done 1',exact:true})).toBeInTheDocument();
    expect(screen.getByRole('tab',{name:'All 4',exact:true})).toBeInTheDocument();
    expect(document.querySelectorAll('.task-row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab',{name:'Done 1',exact:true}));
    expect(document.querySelectorAll('.task-row')).toHaveLength(1);
    expect(screen.getByLabelText('Task completed')).toBeChecked();
  });

  it('renders the shared New task action', async () => {
    render(<MemoryRouter><Tasks /></MemoryRouter>);
    await screen.findByRole('tab', {name:'All 4',exact:true});
    expect(screen.getByRole('button', { name: '+ New task',exact:true })).toHaveAttribute('data-re-button','primary');
  });

  it('treats manually sourced tasks as staff-created, not automated', async () => {
    api.getTasks.mockResolvedValue([makeTask({sourceType:'manual',name:'Staff follow-up'}),makeTask({id:'automatic',sourceType:'medical_submission',name:'Review upload'})] as any);
    render(<MemoryRouter><Tasks /></MemoryRouter>);
    await screen.findByRole('tab',{name:'Open 2',exact:true});
    fireEvent.click(screen.getByText('More filters'));
    fireEvent.click(screen.getByRole('button',{name:'Staff-created',exact:true}));
    expect(screen.getByRole('button',{name:'Staff follow-up',exact:true})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Review upload',exact:true})).not.toBeInTheDocument();
  });

  it('renders the client-support inbox workspace instead of the grid when ?support is present', async () => {
    render(<MemoryRouter initialEntries={['/admin/tasks?support=all']}><Tasks /></MemoryRouter>);
    expect(await screen.findByTestId('client-support-inbox')).toBeInTheDocument();
    expect(api.getTasks).not.toHaveBeenCalled();
  });
});
