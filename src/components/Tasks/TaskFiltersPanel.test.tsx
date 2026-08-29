import { fireEvent, render, screen } from '@testing-library/react';
import { TaskFiltersPanel } from './TaskFiltersPanel';

describe('TaskFiltersPanel', () => {
  it('updates every task filter without discarding the others', () => {
    const onChange = jest.fn();
    const filters: any = { type: 'client', status: 'pending', urgency: 'high', dueDateFrom: '2026-08-01', dueDateTo: '2026-08-31', sortBy: 'dueDate', sortOrder: 'asc', overdue: false };
    render(<TaskFiltersPanel filters={filters} onFiltersChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'retreat' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, type: 'retreat' });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, status: 'completed' });
    fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'medium' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, urgency: 'medium' });
    fireEvent.change(document.getElementById('due-from')!, { target: { value: '2026-08-10' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, dueDateFrom: '2026-08-10' });
    fireEvent.change(document.getElementById('due-to')!, { target: { value: '2026-08-20' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, dueDateTo: '2026-08-20' });
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, sortBy: 'name' });
    fireEvent.change(document.getElementById('sort-order')!, { target: { value: 'desc' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, sortOrder: 'desc' });
    fireEvent.click(screen.getByLabelText(/Overdue only/));
    expect(onChange).toHaveBeenLastCalledWith({ ...filters, overdue: true });
  });

  it('turns empty values into undefined API filters', () => {
    const onChange = jest.fn();
    render(<TaskFiltersPanel filters={{ type: 'client' }} onFiltersChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ type: undefined });
  });

  it('sets both date boundaries to today', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
    const onChange = jest.fn();
    render(<TaskFiltersPanel filters={{ type: 'client' }} onFiltersChange={onChange} />);
    fireEvent.click(screen.getByTitle("Filter today's tasks"));
    expect(onChange).toHaveBeenCalledWith({ type: 'client', dueDateFrom: '2026-08-29', dueDateTo: '2026-08-29' });
    jest.useRealTimers();
  });

  it('clears all filters while preserving the default sort', () => {
    const onChange = jest.fn();
    render(<TaskFiltersPanel filters={{ type: 'client', overdue: true, sortOrder: 'desc' }} onFiltersChange={onChange} />);
    fireEvent.click(screen.getByText('Clear All'));
    expect(onChange).toHaveBeenCalledWith({ sortBy: 'dueDate', sortOrder: 'asc' });
  });

  it('renders safe defaults for an empty filter object', () => {
    render(<TaskFiltersPanel filters={{}} onFiltersChange={jest.fn()} />);
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getByLabelText('Urgency')).toHaveValue('');
    expect(screen.getByLabelText('Sort')).toHaveValue('dueDate');
    expect(document.getElementById('sort-order')).toHaveValue('asc');
    expect(screen.getByLabelText(/Overdue only/)).not.toBeChecked();
  });
});
