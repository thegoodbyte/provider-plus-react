import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { bookingsApi, clientsApi, retreatsApi } from '../../services/api';
import { TaskForm } from './TaskForm';

jest.mock('../../services/api', () => ({
  clientsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() }, bookingsApi: { getAll: jest.fn() },
}));
jest.mock('./SearchableSelect', () => ({
  SearchableSelect: ({ id, value, options, onChange, loading, placeholder }: any) => <div>
    <span>{loading ? `Loading ${id}` : `Ready ${id}`}</span>
    <select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">None</option>{options.map((option: any) => <option key={option.id} value={option.id}>{option.label} | {option.sublabel}</option>)}
    </select>
  </div>,
}));

const clients = clientsApi as jest.Mocked<typeof clientsApi>;
const retreats = retreatsApi as jest.Mocked<typeof retreatsApi>;
const bookings = bookingsApi as jest.Mocked<typeof bookingsApi>;

// PPVC-868: Type/Category/the context selector/Source/checkboxes/Urgency/Due
// Date/Tags/Notes all live behind a collapsed "More options" accordion now --
// open it before interacting with any of them, same as a real user would.
const openMore = () => fireEvent.click(screen.getByText('More options'));

describe('TaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clients.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'client-1', display_id: 1201, firstName: 'Eva', lastName: 'Novak', email: 'eva@example.com', phone: '123', workflowStatus: 'active' }] });
    (retreats.getAll as jest.Mock).mockResolvedValue({ data: { data: [{ _id: 'retreat-1', display_id: 44, name: 'September', startDate: '2026-09-01', endDate: '2026-09-08', location: 'Prague', status: 'active' }] } });
    (bookings.getAll as jest.Mock).mockResolvedValue({ data: { items: [{ _id: 'booking-1', bookingNumber: 1267, clientId: { _id: 'client-1', firstName: 'Eva', lastName: 'Novak' }, retreatId: { _id: 'retreat-1', code: 'SEP-26' }, status: 'active' }] } });
  });
  afterEach(async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); });

  it('creates a quick generic task and defaults its description to the title', async () => {
    const onSubmit = jest.fn(); const onCancel = jest.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={onCancel} error="Please review" />);
    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByText('Please review')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Task Name *'), { target: { value: 'Upload EKG tonight' } });
    openMore();
    fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'medical' } });
    fireEvent.change(screen.getByLabelText('Urgency *'), { target: { value: 'urgent' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Upload EKG tonight', description: 'Upload EKG tonight', type: 'generic', category: 'medical', urgency: 'urgent',
      dueDate: undefined, clientId: undefined, retreatId: undefined, bookingId: undefined, notes: undefined,
    }));
    fireEvent.click(screen.getByText('Cancel')); fireEvent.click(screen.getByText('×'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('defaults the "More options" accordion closed when creating, open when editing (PPVC-868)', () => {
    const { unmount } = render(<TaskForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByLabelText('Urgency *')).not.toBeVisible();
    unmount();

    render(<TaskForm task={{ id: 't1', name: 'Existing', description: '', type: 'generic', urgency: 'low', status: 'pending', tags: [], createdAt: '', updatedAt: '' } as any} onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('Urgency *')).toBeVisible();
  });

  it('hides the client selector entirely when the page already knows the client (PPVC-868)', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm clientId="client-1" onSubmit={onSubmit} onCancel={jest.fn()} />);
    openMore();
    expect(screen.getByLabelText('Type *')).toHaveValue('client');
    expect(screen.queryByLabelText('Select Client *')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search for a client...')).not.toBeInTheDocument();
    // Source/notify/visible toggles -- still client-specific fields -- remain.
    expect(screen.getByLabelText('Source')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Task Name *'), { target: { value: 'Call about EKG' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'client', clientId: 'client-1' }));
  });

  it('hides the booking selector when bookingId is already known, but still shows the context banner', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm bookingId="booking-1" bookingLabel="Booking #1267 — Eva" clientId="client-1" retreatId="retreat-1" onSubmit={onSubmit} onCancel={jest.fn()} />);
    expect(screen.getByText('Booking #1267 — Eva')).toBeInTheDocument();
    openMore();
    expect(screen.queryByLabelText('Select Booking *')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search by booking or client...')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Task Name *'), { target: { value: 'Check arrival' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'booking', bookingId: 'booking-1', clientId: 'client-1', retreatId: 'retreat-1' }));
  });

  it('still derives client and retreat from a searchable booking when no booking context was already supplied', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    openMore();
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'booking' } });
    const select = await screen.findByLabelText('Search by booking or client...');
    fireEvent.change(select, { target: { value: 'booking-1' } });
    fireEvent.change(screen.getByLabelText('Task Name *'), { target: { value: 'Check arrival' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'booking', bookingId: 'booking-1', clientId: 'client-1', retreatId: 'retreat-1' }));
  });

  it('switches between searchable client, retreat and booking task types', async () => {
    render(<TaskForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    openMore();
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'client' } });
    await waitFor(() => expect(screen.getByText('Ready clientId')).toBeInTheDocument());
    expect(screen.getByText(/Client #1201 - Eva Novak/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search for a client...'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'retreat' } });
    expect(await screen.findByText(/Retreat #44 - September/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search for a retreat...'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'booking' } });
    expect(screen.getByLabelText('Search by booking or client...')).toBeInTheDocument();
  });

  it('edits populated-object task relationships, dates, tags and notes', async () => {
    const onSubmit = jest.fn();
    const item: any = {
      id: 'task', name: 'Existing', description: 'Details', type: 'client', urgency: 'low', status: 'pending',
      dueDate: '2026-09-03T10:00:00Z', clientId: { _id: 'client-1' }, retreatId: { id: 'retreat-1' },
      bookingId: { id: 'booking-1' }, tags: ['medical', 'duplicate'], notes: 'Private note', createdAt: '', updatedAt: '',
    };
    render(<TaskForm task={item} onSubmit={onSubmit} onCancel={jest.fn()} />);
    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByLabelText('Task Name *')).toHaveValue('Existing');
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-09-03');
    const tags = screen.getByLabelText('Tags');
    fireEvent.change(tags, { target: { value: 'duplicate' } }); fireEvent.keyDown(tags, { key: 'Enter' });
    expect(screen.getAllByText('duplicate')).toHaveLength(1);
    fireEvent.change(tags, { target: { value: ' tonight ' } }); fireEvent.keyDown(tags, { key: 'Enter' });
    expect(screen.getByText('tonight')).toBeInTheDocument();
    fireEvent.click(screen.getByText('medical').parentElement!.querySelector('button')!);
    expect(screen.queryByText('medical')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Update Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: ['duplicate', 'tonight'], notes: 'Private note' }));
  });

  it('supports today and tomorrow quick due dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
    render(<TaskForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-08-29');
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-08-30');
    jest.useRealTimers();
  });

  it('uses client and retreat context to override the initial generic type', () => {
    const { rerender } = render(<TaskForm clientId="client-1" initialType="generic" onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('Type *')).toHaveValue('client');
    rerender(<TaskForm retreatId="retreat-1" initialType="generic" onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByLabelText('Type *')).toHaveValue('retreat');
  });

  it('normalizes results/items arrays and tolerates malformed responses', async () => {
    (clients.getAll as jest.Mock).mockResolvedValue({ data: { results: [{ id: 'legacy-client', fname: 'Legacy', lname: 'Client', clientNumber: 88, status: 'active' }, { email: 'missing-id' }] } });
    (retreats.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'legacy-retreat', code: 'OCT', title: 'October', dates: { startDate: 'invalid' } }, {}] });
    (bookings.getAll as jest.Mock).mockResolvedValue({ data: { results: [{ id: 'legacy-booking', bookingHash: 'hash', clientId: 'client', retreatId: 'retreat' }, {}] } });
    render(<TaskForm initialType="client" onSubmit={jest.fn()} onCancel={jest.fn()} />);
    openMore();
    expect(await screen.findByText(/Client #88 - Legacy Client/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'retreat' } });
    expect(screen.getByText(/Retreat #OCT - October/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'booking' } });
    expect(screen.getByText(/Booking #hash/)).toBeInTheDocument();
  });

  it('defaults client-only notify/visible toggles and a WhatsApp source, and lets staff turn them off (PPVC-795)', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} onCancel={jest.fn()} />);
    openMore();
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'client' } });
    await waitFor(() => expect(screen.getByText('Ready clientId')).toBeInTheDocument());
    expect(screen.getByLabelText('Source')).toHaveValue('');
    const notifyToggle = screen.getByLabelText('Email client on status change') as HTMLInputElement;
    const visibleToggle = screen.getByLabelText('Visible in client portal') as HTMLInputElement;
    expect(notifyToggle.checked).toBe(true);
    expect(visibleToggle.checked).toBe(true);

    fireEvent.change(screen.getByLabelText('Task Name *'), { target: { value: 'Follow up on WhatsApp' } });
    fireEvent.change(screen.getByLabelText('Search for a client...'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'whatsapp' } });
    fireEvent.click(notifyToggle);

    fireEvent.submit(screen.getByRole('button', { name: 'Create Task' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'client', clientId: 'client-1', sourceType: 'whatsapp', notifyClient: false, visibleToClient: true,
    }));

    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'generic' } });
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email client on status change')).not.toBeInTheDocument();
  });

  it('stops loading and logs API failures without crashing the form', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (clients.getAll as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<TaskForm initialType="client" onSubmit={jest.fn()} onCancel={jest.fn()} />);
    openMore();
    expect(screen.getByText('Loading clientId')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ready clientId')).toBeInTheDocument());
    expect(error).toHaveBeenCalledWith('Error loading clients and retreats:', expect.any(Error));
  });
});
