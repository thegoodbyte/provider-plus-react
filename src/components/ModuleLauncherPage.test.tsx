import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModuleLauncherPage from './ModuleLauncherPage';
import { useAuth } from '../context/AuthContext';
import { launcherConfigApi } from '../services/api';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./TasksForTodayPanel', () => () => null);
jest.mock('../services/api', () => ({ launcherConfigApi: { get: jest.fn(), save: jest.fn() } }));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
  (launcherConfigApi.get as jest.Mock).mockResolvedValue({ data: { assignments: [] } });
  (launcherConfigApi.save as jest.Mock).mockResolvedValue({ data: {} });
});
const view = () => render(<MemoryRouter initialEntries={['/admin/launcher']}><ModuleLauncherPage /></MemoryRouter>);

it('separates configuration and uses the same feature names as the sidebar', async () => {
  view();
  const setup = screen.getByRole('region', { name: 'Settings & Setup' });
  const daily = screen.getByRole('region', { name: 'Daily Work' });
  for (const name of ['Booking Step Library', 'Booking Document Types', 'Retreat Readiness Setup']) {
    expect(within(setup).getByRole('button', { name })).toBeVisible();
    expect(within(daily).queryByRole('button', { name })).not.toBeInTheDocument();
  }
  for (const name of ['Clients', 'Bookings', 'Retreats', 'Payment Requests', 'Readiness Dashboard', 'Booking Requirements']) {
    expect(within(daily).getByRole('button', { name })).toBeVisible();
  }
  expect(screen.queryByRole('button', { name: 'Invoices' })).not.toBeInTheDocument();
  await waitFor(() => expect(launcherConfigApi.get).toHaveBeenCalled());
});

it('limits medical advisors to their actual routes even during admin impersonation', () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'medical_advisor', originalRole: 'admin' } });
  view();
  expect(screen.getByRole('button', { name: 'Medical Dashboard' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Review Requests' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Clients' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Settings & Setup' })).not.toBeInTheDocument();
});

it('applies navigation preferences and preserves saved hidden shortcuts when saving', async () => {
  localStorage.setItem('navigationPermissions:v1', JSON.stringify({ users: [] }));
  (launcherConfigApi.get as jest.Mock).mockResolvedValue({ data: { assignments: [
    { moduleId: 'analytics', ring: 'hidden' }, { moduleId: 'future-module', ring: 'outer' },
  ] } });
  view();
  expect(screen.queryByRole('button', { name: 'User Management' })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Analytics' })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Customize shortcuts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save shortcuts' }));
  await waitFor(() => expect(launcherConfigApi.save).toHaveBeenCalledWith(expect.arrayContaining([
    { moduleId: 'analytics', ring: 'hidden' }, { moduleId: 'future-module', ring: 'outer' },
  ])));
});
