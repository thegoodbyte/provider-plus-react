import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import IntegrationRetreatDetailPage from './IntegrationRetreatDetailPage';
import { integrationApi } from '../services/api';

jest.mock('../services/api', () => ({
  integrationApi: {
    getCheckpointDetail: jest.fn(),
    updateCheckpoint: jest.fn(),
    updateResponse: jest.fn(),
  },
}));

const baseDetail = {
  retreat: { id: 'retreat-1', name: 'BEN-05-30-26' },
  checkpoint: { id: 'c1', checkpointNumber: 1, targetDate: '2026-06-13T00:00:00.000Z', notes: '' },
  questions: [
    { key: 'howAreYouDoing', label: 'How are you doing?' },
    { key: 'challenges', label: 'What are your challenges right now?' },
  ],
  tiles: [
    {
      responseId: 'resp-1', clientId: 'client-1', clientName: 'Alice A', clientLink: '/admin/clients/client-1', bookingId: 'booking-1',
      callType: 'group', status: 'not_reached', answers: { howAreYouDoing: 'Doing okay' }, notes: '',
    },
  ],
};

const view = (path = '/admin/integration/retreat-1') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/integration/:retreatId" element={<IntegrationRetreatDetailPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('IntegrationRetreatDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (integrationApi.getCheckpointDetail as jest.Mock).mockResolvedValue({ data: baseDetail });
    (integrationApi.updateResponse as jest.Mock).mockResolvedValue({ data: {} });
    (integrationApi.updateCheckpoint as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows the client tile with its pre-filled answer, and saves an edited answer merged by question key', async () => {
    view();

    expect(await screen.findByText('Alice A')).toBeInTheDocument();
    const textarea = screen.getByDisplayValue('Doing okay');
    fireEvent.change(textarea, { target: { value: 'Doing much better now' } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(integrationApi.updateResponse).toHaveBeenCalledWith('resp-1', { answers: { howAreYouDoing: 'Doing much better now' } }));
  });

  it('switching a tile to Individual reveals a scheduled-for field and saves the call type', async () => {
    view();
    await screen.findByText('Alice A');

    fireEvent.change(screen.getByLabelText(/call type/i), { target: { value: 'individual' } });

    await waitFor(() => expect(integrationApi.updateResponse).toHaveBeenCalledWith('resp-1', { callType: 'individual' }));
    expect(await screen.findByLabelText(/scheduled for/i)).toBeInTheDocument();
  });

  it('marking a tile reached saves the new status', async () => {
    view();
    await screen.findByText('Alice A');

    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: 'reached' } });

    await waitFor(() => expect(integrationApi.updateResponse).toHaveBeenCalledWith('resp-1', { status: 'reached' }));
  });

  it('switches checkpoints and reschedules the target date for the new checkpoint', async () => {
    view();
    await screen.findByText('Alice A');

    fireEvent.click(screen.getByRole('tab', { name: /call 2/i }));
    await waitFor(() => expect(integrationApi.getCheckpointDetail).toHaveBeenCalledWith('retreat-1', 2));

    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-07-01' } });
    fireEvent.blur(screen.getByLabelText(/target date/i));

    await waitFor(() => expect(integrationApi.updateCheckpoint).toHaveBeenCalledWith('retreat-1', 2, { targetDate: '2026-07-01' }));
  });
});
