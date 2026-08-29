import { fireEvent, render, screen } from '@testing-library/react';
import { taskService } from '../../services/taskService';
import TasksCalendarView from './TasksCalendarView';

jest.mock('../../services/taskService', () => ({ taskService: { isOverdue: jest.fn() } }));

const task = (overrides: any = {}) => ({ id: 'task', name: 'Upload EKG', description: '', type: 'client', urgency: 'high', status: 'pending', tags: [], createdAt: '', updatedAt: '', ...overrides });

describe('TasksCalendarView', () => {
  beforeEach(() => { (taskService.isOverdue as jest.Mock).mockImplementation((_date, status) => status !== 'completed'); });

  it('combines task and booking deadlines with client, booking and retreat context', () => {
    render(<TasksCalendarView tasks={[
      task({ dueDate: '2026-09-03', clientId: { firstName: 'Eva', lastName: 'Novak', display_id: 1201 }, retreatId: { code: 'SEP-26' } }),
      task({ id: 'invalid', name: 'Invalid', dueDate: 'not-a-date' }),
      task({ id: 'none', name: 'No date', dueDate: undefined }),
    ]} deadlines={[
      { _id: 'deadline', title: 'Balance paid', dueDate: '2026-09-03', status: 'in_progress', bookingId: { bookingNumber: 1267, clientId: { fname: 'Pawel', lname: 'Dolata', email: 'p@example.com' }, retreatId: { retreatCode: 'SEP' } } } as any,
      { _id: 'bad', title: 'Bad deadline', dueDate: 'bad' } as any,
    ]} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/September 2026/);
    expect(screen.getByText('Upload EKG')).toBeInTheDocument();
    expect(screen.getByText('#1201 Eva Novak - SEP-26 - client')).toBeInTheDocument();
    expect(screen.getByText('Balance paid')).toBeInTheDocument();
    expect(screen.getByText('Pawel Dolata - Booking #1267 - SEP')).toBeInTheDocument();
    expect(screen.queryByText('Invalid')).not.toBeInTheDocument();
    expect(screen.queryByText('Bad deadline')).not.toBeInTheDocument();
    expect(screen.getByText('2 item(s), 2 overdue')).toBeInTheDocument();
    expect(screen.getAllByText(/in progress/).length).toBeGreaterThan(0);
  });

  it('sorts same-day events by title and summarizes more than four items', () => {
    render(<TasksCalendarView tasks={['Zulu', 'Alpha', 'Beta', 'Gamma', 'Delta'].map((name, index) => task({ id: String(index), name, dueDate: '2026-09-03', status: index ? 'completed' : 'pending' }))} deadlines={[]} />);
    const titles = Array.from(document.querySelectorAll('.event-title')).map((node) => node.textContent);
    expect(titles).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(screen.getByText('5 item(s), 1 overdue')).toBeInTheDocument();
  });

  it('moves between months and returns to the current month', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
    render(<TasksCalendarView tasks={[task({ dueDate: '2026-09-03' })]} deadlines={[]} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('September 2026');
    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('August 2026');
    fireEvent.click(screen.getByText('Next')); fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('October 2026');
    fireEvent.click(screen.getByText('Today'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('August 2026');
    expect(document.querySelector('.tasks-calendar-day.today')).toBeInTheDocument();
    expect(document.querySelector('.tasks-calendar-day.outside-month')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('uses today when there are no events and handles fallback labels', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
    const { rerender } = render(<TasksCalendarView tasks={[]} deadlines={[]} />);
    expect(screen.getByText('0 item(s), 0 overdue')).toBeInTheDocument();
    rerender(<TasksCalendarView tasks={[]} deadlines={[
      { key: 'fallback-key', dueDate: '2026-08-29', clientId: { email: 'only@example.com' }, retreatId: { name: 'Named retreat' } } as any,
      { dueDate: '2026-08-30', bookingId: 'booking-string' } as any,
    ]} />);
    expect(screen.getByText('fallback-key')).toBeInTheDocument();
    expect(screen.getByText('only@example.com - Named retreat')).toBeInTheDocument();
    expect(screen.getByText('Booking deadline')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
