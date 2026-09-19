import React, { lazy } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteContentBoundary from './RouteContentBoundary';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/authService', () => ({ authService: { logout: jest.fn() } }));

it('keeps navigation visible while a page downloads, then displays the page', async () => {
  let resolve!: (value: { default: React.ComponentType }) => void;
  const Page = lazy(() => new Promise<{ default: React.ComponentType }>(done => { resolve = done; }));
  render(<MemoryRouter><nav>Application menu</nav><RouteContentBoundary><Page /></RouteContentBoundary></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading page…');
  expect(screen.getByRole('navigation')).toBeVisible();
  await act(async () => resolve({ default: () => <h1>Loaded screen</h1> }));
  expect(screen.getByRole('heading', { name: 'Loaded screen' })).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('offers recovery on a rejected import and clears the error when navigating away', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const Page = lazy(() => Promise.reject(new Error('Loading chunk failed')));
    render(<MemoryRouter initialEntries={['/broken']}>
      <Link to="/working">Open working page</Link>
      <RouteContentBoundary><Routes>
        <Route path="/broken" element={<Page />} />
        <Route path="/working" element={<h1>Working page</h1>} />
      </Routes></RouteContentBoundary>
    </MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('This page couldn’t load');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Open working page' }));
    expect(screen.getByRole('heading', { name: 'Working page' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally { errorLog.mockRestore(); }
});

it('does not request a protected page chunk when permission is denied', async () => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, user: { role: 'facilitator' } });
  const load = jest.fn(async () => ({ default: () => <h1>Administration</h1> }));
  const Page = lazy(load);
  render(<MemoryRouter initialEntries={['/admin/users']}><RouteContentBoundary><Routes>
    <Route path="/admin/users" element={<ProtectedRoute requiredRole={['admin']}><Page /></ProtectedRoute>} />
    <Route path="/unauthorized" element={<h1>Access denied</h1>} />
  </Routes></RouteContentBoundary></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible();
  expect(load).not.toHaveBeenCalled();
});
