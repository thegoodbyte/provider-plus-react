import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubmissionNotificationsPage from './SubmissionNotificationsPage';
import { api } from '../services/api';

jest.mock('../services/api', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  bookingDocumentsApi: { getAll: jest.fn(), getFile: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;
const notices = [
  { _id: 'n1', name: 'Review EKG', status: 'pending', sourceId: 'ekg:1', retreatId: { _id: 'r1', name: 'September retreat' }, clientId: { _id: 'c1', firstName: 'Anna', lastName: 'Nowak' } },
  { _id: 'n2', name: 'Review medications', status: 'pending', sourceId: 'medications_initial:2', notificationReadAt: '2026-08-29T10:00:00Z', retreatId: { _id: 'r2', name: 'October retreat' }, clientId: { _id: 'c2', firstName: 'Jan', lastName: 'Kowalski' } },
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
});
