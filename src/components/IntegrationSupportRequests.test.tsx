import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntegrationSupportRequests from './IntegrationSupportRequests';
import { integrationCalendarApi } from '../services/integrationCalendarApi';
jest.mock('../services/integrationCalendarApi', () => ({
  integrationCalendarApi: {
    supportRequests: jest.fn(),
    updateSupportRequest: jest.fn(),
  },
}));
const request = {
  _id: 'request',
  clientId: {
    _id: 'client',
    firstName: 'Ada',
    lastName: 'Guest',
    email: 'ada@example.com',
  },
  retreatId: { _id: 'retreat', name: 'JNO September' },
  status: 'requested',
  createdAt: '2026-10-05',
  message: 'I need some support',
};
beforeEach(() => {
  jest.clearAllMocks();
  (integrationCalendarApi.supportRequests as jest.Mock).mockResolvedValue({
    data: [request],
  });
  (integrationCalendarApi.updateSupportRequest as jest.Mock).mockResolvedValue({
    data: {},
  });
});
it('shows the client request and opens scheduling with the right participant', async () => {
  const onSchedule = jest.fn();
  render(
    <IntegrationSupportRequests retreatId="retreat" onSchedule={onSchedule} />,
  );
  await screen.findByText('Ada Guest');
  expect(screen.getByText('I need some support')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Schedule individual call' }),
  );
  expect(onSchedule).toHaveBeenCalledWith(request);
  expect(integrationCalendarApi.supportRequests).toHaveBeenCalledWith(
    'retreat',
  );
});
it('marks the request contacted and closes it explicitly', async () => {
  render(<IntegrationSupportRequests onSchedule={jest.fn()} />);
  await screen.findByText('Ada Guest');
  fireEvent.click(screen.getByRole('button', { name: 'Mark contacted' }));
  await waitFor(() =>
    expect(integrationCalendarApi.updateSupportRequest).toHaveBeenCalledWith(
      'request',
      'contacted',
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Close request' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close request' }));
  await waitFor(() =>
    expect(integrationCalendarApi.updateSupportRequest).toHaveBeenCalledWith(
      'request',
      'closed',
    ),
  );
});
it('retains the request when a status save fails', async () => {
  (integrationCalendarApi.updateSupportRequest as jest.Mock).mockRejectedValue(
    new Error('offline'),
  );
  render(<IntegrationSupportRequests onSchedule={jest.fn()} />);
  await screen.findByText('Ada Guest');
  fireEvent.click(screen.getByRole('button', { name: 'Close request' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Ada Guest')).toBeInTheDocument();
});
