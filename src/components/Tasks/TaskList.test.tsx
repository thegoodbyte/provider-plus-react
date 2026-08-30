import { fireEvent, render, screen, within } from '@testing-library/react';
import { Task, taskService } from '../../services/taskService';
import { TaskList } from './TaskList';

jest.mock('../../services/taskService', () => ({ taskService: { isOverdue: jest.fn((date: string, status: string) => status !== 'completed' && date.startsWith('2020')) } }));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'one', name: 'Upload EKG', description: 'Tonight', type: 'client', urgency: 'high', status: 'pending',
  dueDate: '2020-01-02', tags: [], createdAt: '2026-08-29', updatedAt: '2026-08-29', ...overrides,
});
const rowNames = () => Array.from(document.querySelectorAll('.task-row .task-title')).map((node) => node.textContent);

describe('TaskList', () => {
  beforeEach(() => { (taskService.isOverdue as jest.Mock).mockImplementation((date: string, status: string) => status !== 'completed' && date.startsWith('2020')); });
  it('renders a useful empty state', () => {
    render(<TaskList tasks={[]} onEditTask={jest.fn()} onDeleteTask={jest.fn()} onCompleteTask={jest.fn()} />);
    expect(screen.getByText('No tasks found. Create your first task to get started!')).toBeInTheDocument();
  });

  it('shows relationship details, origins, badges, dates and overdue state', () => {
    const tasks = [
      makeTask({
        clientId: { firstName: 'Eva', lastName: 'Novak', email: 'eva@example.com', display_id: 1201 },
        retreatId: { name: 'September', code: 'SEP-26', startDate: '', endDate: '' },
        bookingId: { bookingNumber: 1267 }, sourceType: 'booking_flow', status: 'in_progress',
      }),
      makeTask({ id: 'two', name: 'Generic note', type: 'generic', urgency: 'low', status: 'completed', dueDate: undefined, bookingId: '507f1f77bcf86cd799439011', clientId: 'client', retreatId: 'retreat' }),
    ];
    render(<TaskList tasks={tasks} onEditTask={jest.fn()} onDeleteTask={jest.fn()} onCompleteTask={jest.fn()} />);
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Eva Novak #1201')).toHaveAttribute('title', 'Eva Novak #1201');
    expect(screen.getByText('SEP-26')).toHaveAttribute('title', 'September SEP-26');
    expect(screen.getByText('#1267')).toBeInTheDocument();
    expect(screen.getByText('#439011')).toBeInTheDocument();
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('No due date')).toBeInTheDocument();
    expect(screen.getByText('Upload EKG').closest('.task-row')).toHaveClass('overdue');
    expect(screen.getByText('Generic note').closest('.task-row')).not.toHaveClass('overdue');
  });

  it('invokes complete, edit and delete actions and hides completion for completed tasks', () => {
    const onComplete = jest.fn(); const onEdit = jest.fn(); const onDelete = jest.fn();
    const pending = makeTask(); const completed = makeTask({ id: 'two', name: 'Done', status: 'completed' });
    render(<TaskList tasks={[pending, completed]} onEditTask={onEdit} onDeleteTask={onDelete} onCompleteTask={onComplete} />);
    const pendingRow = screen.getByText('Upload EKG').closest('.task-row') as HTMLElement;
    fireEvent.click(within(pendingRow).getByLabelText('Mark task as complete'));
    fireEvent.click(within(pendingRow).getByLabelText('Edit task'));
    fireEvent.click(within(pendingRow).getByLabelText('Delete task'));
    expect(onComplete).toHaveBeenCalledWith('one'); expect(onEdit).toHaveBeenCalledWith(pending); expect(onDelete).toHaveBeenCalledWith('one');
    expect(within(screen.getByText('Done').closest('.task-row')!).queryByLabelText('Mark task as complete')).not.toBeInTheDocument();
  });

  it('sorts due dates ascending and descending with missing dates last/first', () => {
    render(<TaskList tasks={[
      makeTask({ id: 'late', name: 'Late', dueDate: '2026-09-10' }),
      makeTask({ id: 'none', name: 'None', dueDate: undefined }),
      makeTask({ id: 'early', name: 'Early', dueDate: '2026-09-01' }),
    ]} onEditTask={jest.fn()} onDeleteTask={jest.fn()} onCompleteTask={jest.fn()} />);
    expect(rowNames()).toEqual(['Early', 'Late', 'None']);
    fireEvent.click(screen.getByText(/Due Date ↑/));
    expect(rowNames()).toEqual(['None', 'Late', 'Early']);
    expect(screen.getByText(/Due Date ↓/)).toBeInTheDocument();
  });

  it.each([
    ['Task Name', ['Alpha', 'Beta']],
    ['Type', ['Alpha', 'Beta']],
    ['Urgency', ['Alpha', 'Beta']],
    ['Status', ['Beta', 'Alpha']],
    ['Booking', ['Alpha', 'Beta']],
    ['Client', ['Alpha', 'Beta']],
    ['Retreat', ['Alpha', 'Beta']],
  ])('sorts by %s and reverses on a second click', (header, ascending) => {
    const alpha = makeTask({ id: 'a', name: 'Alpha', type: 'client', urgency: 'low', status: 'pending', bookingId: { bookingHash: 'A' }, clientId: { firstName: 'A', lastName: 'Client', email: '' }, retreatId: { name: 'A retreat', code: '', startDate: '', endDate: '' } });
    const beta = makeTask({ id: 'b', name: 'Beta', type: 'retreat', urgency: 'urgent', status: 'completed', bookingId: { _id: 'B' }, clientId: { firstName: 'B', lastName: 'Client', email: '' }, retreatId: { name: 'B retreat', code: '', startDate: '', endDate: '' } });
    render(<TaskList tasks={[beta, alpha]} onEditTask={jest.fn()} onDeleteTask={jest.fn()} onCompleteTask={jest.fn()} />);
    const cell = Array.from(document.querySelectorAll('.task-grid-header .sortable')).find((node) => node.textContent?.startsWith(header))!;
    fireEvent.click(cell);
    expect(rowNames()).toEqual(ascending);
    fireEvent.click(cell);
    expect(rowNames()).toEqual([...ascending].reverse());
  });

  it('handles legacy names and relationship identifiers safely', () => {
    render(<TaskList tasks={[
      makeTask({ clientId: { firstName: '', lastName: '', fname: 'Legacy', lname: 'Person', email: '', displayId: 88 } as any, bookingId: { id: 'booking-id' }, retreatId: { name: 'Named retreat', code: '', startDate: '', endDate: '' } }),
      makeTask({ id: 'empty', name: 'Fallbacks', clientId: {} as any, bookingId: {} as any, retreatId: undefined }),
    ]} onEditTask={jest.fn()} onDeleteTask={jest.fn()} onCompleteTask={jest.fn()} />);
    expect(screen.getByText('Legacy Person #88')).toBeInTheDocument();
    expect(screen.getByText('#booking-id')).toBeInTheDocument();
    expect(screen.getByText('Named retreat')).toBeInTheDocument();
    expect(screen.getByText('Client No client #')).toBeInTheDocument();
  });
});
