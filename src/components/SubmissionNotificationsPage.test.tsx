import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubmissionNotificationsPage, { notificationDateKey, notificationDateLabel } from './SubmissionNotificationsPage';
import { api } from '../services/api';

jest.mock('../services/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  bookingDocumentsApi: { getAll: jest.fn(), getFile: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const notices = [
  { _id: 'n1', name: 'Review EKG', status: 'pending', sourceId: 'ekg:1', createdAt: '2026-09-05T10:00:00Z', retreatId: { _id: 'r1', name: 'September retreat' }, clientId: { _id: 'c1', firstName: 'Anna', lastName: 'Nowak' } },
  { _id: 'n2', name: 'Review medications', status: 'pending', sourceId: 'medications_initial:2', createdAt: '2026-09-04T10:00:00Z', notificationReadAt: '2026-08-29T10:00:00Z', retreatId: { _id: 'r2', name: 'October retreat' }, clientId: { _id: 'c2', firstName: 'Jan', lastName: 'Kowalski' } },
];

const renderPage = () => render(<MemoryRouter><SubmissionNotificationsPage /></MemoryRouter>);

describe('SubmissionNotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: notices } as any);
    mockedApi.patch.mockResolvedValue({ data: {} } as any);
  });

  it('filters notifications by retreat', async () => {
    renderPage();
    expect(await screen.findByText('Review EKG')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by retreat'), { target: { value: 'r2' } });
    expect(screen.queryByText('Review EKG')).not.toBeInTheDocument();
    expect(screen.getByText('Review medications')).toBeInTheDocument();
  });

  it('groups notifications under date headings while preserving each date group', async () => {
    renderPage();
    expect(await screen.findByRole('region', { name: notificationDateLabel(notificationDateKey(notices[0])) })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: notificationDateLabel(notificationDateKey(notices[1])) })).toBeInTheDocument();
  });

  it('marks multiple selected notifications read', async () => {
    renderPage();
    await screen.findByText('Review EKG');
    fireEvent.click(screen.getByLabelText('Select all shown'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark selected read' }));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledTimes(2));
    expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/n1/read');
    expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/n2/read');
    await waitFor(() => expect(screen.getByText('0 selected')).toBeInTheDocument());
  });

  it('marks selected notifications unread', async () => {
    renderPage();
    await screen.findByText('Review medications');
    fireEvent.click(screen.getByLabelText('Select Review medications'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark selected unread' }));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/n2/unread'));
  });

  it('purges past-retreat notifications in one action and reloads the list (PPVC-600)', async () => {
    mockedApi.patch.mockResolvedValue({ data: { markedCount: 3 } } as any);
    renderPage();
    await screen.findByText('Review EKG');

    fireEvent.click(screen.getByRole('button', { name: /purge past retreats/i }));

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/purge-past-retreats'));
    expect(await screen.findByText(/3 past-retreat notification/i)).toBeInTheDocument();
    // 2 calls on mount (main list + the PPVC-685 archived-section fetch),
    // plus 1 more from purgePastRetreats's own reload of the main list.
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledTimes(3));
  });

  describe('archiving (PPVC-685)', () => {
    const archived = [{ _id: 'n3', name: 'Old contract', status: 'pending', sourceId: 'contract:3', createdAt: '2026-07-01T10:00:00Z', notificationReadAt: '2026-07-02T10:00:00Z', notificationArchivedAt: '2026-07-02T10:00:00Z', retreatId: { _id: 'r3', name: 'July retreat' }, clientId: { _id: 'c3', firstName: 'Eva', lastName: 'Dvorak' } }];

    beforeEach(() => {
      mockedApi.get.mockImplementation((_url: string, options?: any) => Promise.resolve({ data: options?.params?.archived ? archived : notices } as any));
    });

    it('archives the selected notifications, marks them read, and removes them from the main list', async () => {
      renderPage();
      await screen.findByText('Review EKG');
      fireEvent.click(screen.getByLabelText('Select Review EKG'));

      fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }));

      await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/archive', { ids: ['n1'] }));
      await waitFor(() => expect(screen.queryByText('Review EKG')).not.toBeInTheDocument());
      expect(screen.getByText('Review medications')).toBeInTheDocument();
    });

    it('shows archived notifications in the collapsible Archived section and can unarchive them', async () => {
      renderPage();
      await screen.findByText('Review EKG');

      fireEvent.click(screen.getByRole('button', { name: /Archived/i }));
      expect(await screen.findByText('Old contract')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));

      await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/submission-notifications/n3/unarchive'));
      await waitFor(() => expect(screen.queryByText('Old contract')).not.toBeInTheDocument());
    });
  });
});

beforeEach(() => { jest.clearAllMocks(); });

it('keeps client and booking tabs scoped and resets filters when switching records', async () => {
  mockedApi.get.mockResolvedValue({ data: notices } as any);
  const page = render(<MemoryRouter><SubmissionNotificationsPage clientId="c1" /></MemoryRouter>);
  await screen.findByText('Review EKG');
  expect(mockedApi.get).toHaveBeenLastCalledWith('/submission-notifications', { params: expect.objectContaining({ clientId: 'c1', bookingId: undefined }) });
  expect(screen.queryByRole('button', { name: /purge past retreats/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filter by retreat'), { target: { value: 'r1' } });
  mockedApi.get.mockResolvedValue({ data: [notices[1]] } as any);
  page.rerender(<MemoryRouter><SubmissionNotificationsPage bookingId="b2" /></MemoryRouter>);
  expect(screen.queryByText('Review EKG')).not.toBeInTheDocument();
  await screen.findByText('Review medications');
  expect(screen.getByLabelText('Filter by retreat')).toHaveValue('');
  expect(mockedApi.get).toHaveBeenLastCalledWith('/submission-notifications', { params: expect.objectContaining({ clientId: undefined, bookingId: 'b2' }) });
});

it('ignores a late response from an earlier filter', async () => {
  let resolveOld: (value: any) => void = () => {};
  mockedApi.get.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  mockedApi.get.mockResolvedValue({ data: [notices[1]] } as any);
  renderPage();
  await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Notification view'), { target: { value: 'history' } });
  await screen.findByText('Review medications');
  await act(async () => { resolveOld({ data: [notices[0]] }); });
  expect(screen.queryByText('Review EKG')).not.toBeInTheDocument();
  expect(screen.getByText('Review medications')).toBeInTheDocument();
});

it.each(['Open source', 'Mark read', 'Reviewed'])('shows failed %s actions in the page', async (action) => {
  mockedApi.get.mockResolvedValue({ data: [notices[0]] } as any);
  mockedApi.patch.mockRejectedValue(new Error('offline'));
  renderPage();
  await screen.findByText('Review EKG');
  fireEvent.click(screen.getByRole('button', { name: action }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update notification');
  expect(screen.getByText('1 unread')).toBeInTheDocument();
});
