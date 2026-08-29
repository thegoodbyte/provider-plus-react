import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { taskService, Task } from '../../services/taskService';
import { SprintBoard } from './SprintBoard';

jest.mock('../../services/taskService', () => ({ taskService: { getSprints: jest.fn(), createSprint: jest.fn(), updateTask: jest.fn() } }));

const api = taskService as jest.Mocked<typeof taskService>;
const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1', name: 'Upload EKG', description: 'Tonight', type: 'client', urgency: 'high', status: 'pending',
  tags: [], createdAt: '2026-08-29', updatedAt: '2026-08-29', ...overrides,
});

describe('SprintBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear();
    (api.getSprints as jest.Mock).mockResolvedValue([]);
    (api.createSprint as jest.Mock).mockImplementation(async (name) => ({ id: name, name }));
    (api.updateTask as jest.Mock).mockResolvedValue(task());
  });

  it('renders four clear swimlanes and distinguishes custom and system tasks', async () => {
    render(<SprintBoard tasks={[
      task(),
      task({ id: 'booking', name: 'Booking requirement', type: 'booking', bookingId: 'b', sourceType: 'booking_flow' }),
      task({ id: 'retreat', name: 'Prepare room', type: 'retreat', retreatId: 'r', urgency: 'medium', status: 'in_progress' }),
      task({ id: 'generic', name: 'Order supplies', type: 'generic', urgency: 'low', status: 'completed', dueDate: '2026-09-01' }),
      task({ id: 'cancelled', name: 'Hidden', status: 'cancelled' }),
    ]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={jest.fn()} />);
    await waitFor(() => expect(api.getSprints).toHaveBeenCalled());
    expect(screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['Client tasks', 'Booking tasks', 'Retreat tasks', 'Generic tasks']);
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0);
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.getAllByText('No due date')).toHaveLength(3);
    expect(screen.getByText(new Date('2026-09-01').toLocaleDateString())).toBeInTheDocument();
  });

  it('loads server sprints and migrates unique local sprints', async () => {
    localStorage.setItem('task-sprints', JSON.stringify(['Local sprint', '', 4, 'Server sprint']));
    (api.getSprints as jest.Mock).mockResolvedValue([{ id: 'server', name: 'Server sprint' }]);
    render(<SprintBoard tasks={[task({ tags: ['sprint:Task sprint'] })]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={jest.fn()} />);
    expect(await screen.findByRole('tab', { name: /Local sprint/ })).toBeInTheDocument();
    expect(api.createSprint).toHaveBeenCalledTimes(1);
    expect(api.createSprint).toHaveBeenCalledWith('Local sprint');
    expect(screen.getByRole('tab', { name: /Server sprint/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Task sprint/ })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('task-sprints')).toBeNull());
  });

  it('recovers from malformed local storage and sprint-loading failures', async () => {
    localStorage.setItem('task-sprints', '{bad json');
    (api.getSprints as jest.Mock).mockRejectedValue('offline');
    render(<SprintBoard tasks={[]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved sprints');
    expect(screen.getByText('This sprint is ready. Assign tasks to it from any task card.')).toBeInTheDocument();
  });

  it('selects sprints, persists the selection and invokes custom-task creation in the lane', async () => {
    (api.getSprints as jest.Mock).mockResolvedValue([{ id: 'august', name: 'August' }]);
    const onCreate = jest.fn();
    render(<SprintBoard tasks={[task({ tags: ['sprint:August'] })]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={onCreate} />);
    fireEvent.click(await screen.findByRole('tab', { name: /August/ }));
    expect(localStorage.getItem('active-task-sprint')).toBe('August');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('August');
    const clientLane = screen.getByRole('heading', { name: 'Client tasks' }).closest('section')!;
    fireEvent.click(within(clientLane).getByText('+ Custom task'));
    expect(onCreate).toHaveBeenCalledWith('client', 'August');
  });

  it('creates a named sprint and ignores a cancelled prompt', async () => {
    const prompt = jest.spyOn(window, 'prompt').mockReturnValueOnce('  September focus  ').mockReturnValueOnce(null);
    (api.getSprints as jest.Mock).mockResolvedValue([{ id: 'existing', name: 'Existing' }]);
    render(<SprintBoard tasks={[]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={jest.fn()} />);
    await screen.findByRole('tab', { name: /Existing/ });
    fireEvent.click(screen.getByText('+ New sprint'));
    expect(await screen.findByRole('tab', { name: /September focus/ })).toHaveAttribute('aria-selected', 'true');
    expect(api.createSprint).toHaveBeenCalledWith('September focus');
    fireEvent.click(screen.getByText('+ New sprint'));
    expect(api.createSprint).toHaveBeenCalledTimes(1);
    prompt.mockRestore();
  });

  it('shows sprint creation failures', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Broken');
    (api.createSprint as jest.Mock).mockRejectedValue(new Error('Could not save sprint'));
    render(<SprintBoard tasks={[]} onChanged={jest.fn()} onEdit={jest.fn()} onCreate={jest.fn()} />);
    fireEvent.click(screen.getByText('+ New sprint'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save sprint');
  });

  it('moves a dragged task to another status and context', async () => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    render(<SprintBoard tasks={[task()]} onChanged={onChanged} onEdit={jest.fn()} onCreate={jest.fn()} />);
    fireEvent.dragStart(screen.getByText('Upload EKG').closest('article')!);
    const bookingLane = screen.getByRole('heading', { name: 'Booking tasks' }).closest('section')!;
    const inProgress = within(bookingLane).getByText('In progress').closest('.sprint-column')!;
    fireEvent.dragOver(inProgress);
    fireEvent.drop(inProgress);
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith('task-1', { type: 'booking', status: 'in_progress', tags: [] }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('assigns and removes sprint tags and opens editing on double click', async () => {
    (api.getSprints as jest.Mock).mockResolvedValue([{ id: 'august', name: 'August' }]);
    const onChanged = jest.fn().mockResolvedValue(undefined); const onEdit = jest.fn();
    const item = task({ tags: ['existing', 'sprint:Old'] });
    render(<SprintBoard tasks={[item]} onChanged={onChanged} onEdit={onEdit} onCreate={jest.fn()} />);
    await screen.findByRole('tab', { name: /August/ });
    fireEvent.click(screen.getByRole('tab', { name: /Old/ }));
    fireEvent.doubleClick(screen.getByText('Upload EKG').closest('article')!);
    expect(onEdit).toHaveBeenCalledWith(item);
    fireEvent.change(await screen.findByLabelText('Move Upload EKG to sprint'), { target: { value: 'August' } });
    await waitFor(() => expect(api.updateTask).toHaveBeenCalledWith('task-1', { tags: ['existing', 'sprint:August'] }));
  });
});
