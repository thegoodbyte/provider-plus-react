import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { taskService } from '../../services/taskService';
import { TasksWidget } from './TasksWidget';

jest.mock('../../services/taskService', () => ({ taskService: { getTasks: jest.fn(), createTask: jest.fn(), updateTask: jest.fn(), deleteTask: jest.fn(), completeTask: jest.fn(), seedRetreatDayPlan: jest.fn() } }));
jest.mock('./TaskList', () => ({ TaskList: ({ tasks, onEditTask, onDeleteTask, onCompleteTask }: any) => <div data-testid="task-list">
  {tasks.map((task: any) => <div key={task.id}><span>{task.name}</span><button onClick={() => onEditTask(task)}>Edit {task.id}</button><button onClick={() => onDeleteTask(task.id)}>Delete {task.id}</button><button onClick={() => onCompleteTask(task.id)}>Complete {task.id}</button></div>)}
</div> }));
jest.mock('./TaskForm', () => ({ TaskForm: ({ task, onSubmit, onCancel, clientId, retreatId, error }: any) => <div data-testid="task-form">
  <span>{task ? `Editing ${task.id}` : 'Creating'}</span><span>{clientId || '-'}</span><span>{retreatId || '-'}</span>{error && <span>{error}</span>}
  <button onClick={() => onSubmit({ name: 'Saved', description: 'Saved', type: retreatId ? 'retreat' : clientId ? 'client' : 'generic', urgency: 'medium' })}>Submit form</button><button onClick={onCancel}>Cancel form</button>
</div> }));

const api = taskService as any;
const item: any = { id: 'one', name: 'Upload EKG', description: '', type: 'client', urgency: 'high', status: 'pending', tags: [], createdAt: '', updatedAt: '' };

describe('TasksWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getTasks.mockResolvedValue([item]); api.createTask.mockResolvedValue(item); api.updateTask.mockResolvedValue(item);
    api.deleteTask.mockResolvedValue(undefined); api.completeTask.mockResolvedValue(item); api.seedRetreatDayPlan.mockResolvedValue([]);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('loads retreat tasks with a limit and a contextual title', async () => {
    api.getTasks.mockResolvedValue([item, { ...item, id: 'two', name: 'Second' }]);
    render(<TasksWidget retreatId="retreat" maxItems={1} />);
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
    expect(await screen.findByText('Retreat Tasks (1)')).toBeInTheDocument();
    expect(api.getTasks).toHaveBeenCalledWith({ retreatId: 'retreat' });
    expect(screen.getByText('Upload EKG')).toBeInTheDocument(); expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('Add 8-day plan')).toBeInTheDocument();
  });

  it('loads client and generic widgets with custom/default titles', async () => {
    const { rerender } = render(<TasksWidget clientId="client" title="Tonight" showCreateButton={false} />);
    expect(await screen.findByText('Tonight (1)')).toBeInTheDocument();
    expect(api.getTasks).toHaveBeenLastCalledWith({ clientId: 'client' });
    expect(screen.queryByText(/Add Task/)).not.toBeInTheDocument();
    rerender(<TasksWidget />);
    await waitFor(() => expect(api.getTasks).toHaveBeenLastCalledWith({}));
    expect(await screen.findByText('Tasks (1)')).toBeInTheDocument();
  });

  it('creates a task from the header and empty-state shortcut', async () => {
    api.getTasks.mockResolvedValueOnce([]).mockResolvedValue([item]);
    render(<TasksWidget clientId="client" />);
    expect(await screen.findByText('No tasks found.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create First Task'));
    expect(screen.getByText('Creating')).toBeInTheDocument(); expect(screen.getByTestId('task-form')).toHaveTextContent('client');
    fireEvent.click(screen.getByText('Submit form'));
    await waitFor(() => expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'client' })));
    expect(await screen.findByText('Upload EKG')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Create new task')); fireEvent.click(screen.getByText('Cancel form'));
    expect(screen.queryByTestId('task-form')).not.toBeInTheDocument();
  });

  it('edits an existing task and reloads the list', async () => {
    render(<TasksWidget />); await screen.findByText('Upload EKG');
    fireEvent.click(screen.getByText('Edit one'));
    expect(screen.getByText('Editing one')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit form'));
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith('one', expect.objectContaining({ name: 'Saved' })));
    expect(api.getTasks).toHaveBeenCalledTimes(2);
  });

  it('creates a generic task when the widget has no booking context', async () => {
    render(<TasksWidget />); await screen.findByText('Upload EKG');
    fireEvent.click(screen.getByTitle('Create new task'));
    fireEvent.click(screen.getByText('Submit form'));
    await waitFor(() => expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ type: 'generic' })));
  });

  it('confirms deletion, supports cancellation, and completes tasks', async () => {
    render(<TasksWidget />); await screen.findByText('Upload EKG');
    (window.confirm as jest.Mock).mockReturnValueOnce(false);
    fireEvent.click(screen.getByText('Delete one')); expect(api.deleteTask).not.toHaveBeenCalled();
    (window.confirm as jest.Mock).mockReturnValueOnce(true);
    fireEvent.click(screen.getByText('Delete one'));
    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith('one'));
    fireEvent.click(screen.getByText('Complete one'));
    await waitFor(() => expect(api.completeTask).toHaveBeenCalledWith('one'));
  });

  it('seeds the retreat plan and disables the button while busy', async () => {
    let resolveSeed: any; api.seedRetreatDayPlan.mockReturnValue(new Promise((resolve: any) => { resolveSeed = resolve; }));
    render(<TasksWidget retreatId="retreat" />); await screen.findByText('Upload EKG');
    fireEvent.click(screen.getByText('Add 8-day plan'));
    expect(screen.getByText('Adding...')).toBeDisabled(); expect(api.seedRetreatDayPlan).toHaveBeenCalledWith('retreat');
    resolveSeed([]);
    await waitFor(() => expect(screen.getByText('Add 8-day plan')).toBeEnabled());
  });

  it('shows load, save, delete, complete and seed errors and allows dismissal', async () => {
    api.getTasks.mockRejectedValueOnce('offline');
    const { unmount } = render(<TasksWidget />);
    expect(await screen.findByText('Failed to load tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByText('×')); expect(screen.queryByText('Failed to load tasks')).not.toBeInTheDocument();
    unmount();

    api.getTasks.mockResolvedValue([item]); api.createTask.mockRejectedValue('save');
    render(<TasksWidget />); await screen.findByText('Upload EKG'); fireEvent.click(screen.getByTitle('Create new task')); fireEvent.click(screen.getByText('Submit form'));
    expect(await screen.findAllByText('Failed to save task')).toHaveLength(2);

    api.deleteTask.mockRejectedValue('delete'); fireEvent.click(screen.getByText('Cancel form')); fireEvent.click(screen.getByText('Delete one'));
    expect(await screen.findByText('Failed to delete task')).toBeInTheDocument();
    api.completeTask.mockRejectedValue(new Error('Completion failed')); fireEvent.click(screen.getByText('Complete one'));
    expect(await screen.findByText('Completion failed')).toBeInTheDocument();
  });

  it('shows retreat-plan errors and custom titles without create controls', async () => {
    api.seedRetreatDayPlan.mockRejectedValue('seed');
    render(<TasksWidget retreatId="retreat" showCreateButton={false} />); await screen.findByText('Upload EKG');
    fireEvent.click(screen.getByText('Add 8-day plan'));
    expect(await screen.findByText('Failed to add 8-day retreat plan')).toBeInTheDocument();
    expect(screen.queryByTitle('Create new task')).not.toBeInTheDocument();
  });
});
