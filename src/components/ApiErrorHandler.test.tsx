import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ApiErrorHandler from './ApiErrorHandler';
import { api } from '../services/api';

jest.mock('../services/api', () => ({ api: { interceptors: { response: { use: jest.fn(), eject: jest.fn() } }, get: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'user' }, logout: jest.fn() }) }));
const mount = jest.fn();
function Draft() { const [value, setValue] = useState(''); useEffect(() => { mount(); }, []); return <input aria-label="Draft" value={value} onChange={event => setValue(event.target.value)} />; }
async function fail(error: any) {
  const handler = (api.interceptors.response.use as jest.Mock).mock.calls[0][1];
  await act(async () => { await handler(error).catch(() => {}); });
}
beforeEach(() => { jest.clearAllMocks(); window.history.replaceState(null, '', '/admin/clients'); });
it('keeps the editor mounted through a read failure and dismissal', async () => {
  render(<ApiErrorHandler><Draft /></ApiErrorHandler>);
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved notes' } });
  await fail({ response: { status: 503, data: { message: 'Mongo credentials secret' } }, config: { method: 'get' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load this information. The service is temporarily unavailable.');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved notes'); expect(mount).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss loading message' }));
  expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved notes'); expect(mount).toHaveBeenCalledTimes(1);
});
it('does not duplicate screen-owned feedback', async () => {
  render(<ApiErrorHandler><Draft /></ApiErrorHandler>);
  await fail({ response: { status: 400 }, config: { suppressGlobalError: true } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('checks connection without retrying writes and retains failed health-check feedback', async () => {
  (api.get as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} });
  render(<ApiErrorHandler><Draft /></ApiErrorHandler>);
  await fail({ request: {}, config: { method: 'get' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  await screen.findByText('The server could not be reached. Check your connection.');
  expect(api.get).toHaveBeenCalledWith('/', { suppressGlobalError: true });
  fireEvent.click(screen.getByRole('button', { name: /Check connection/ }));
  await act(async () => {}); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('keeps advisor-packet access recovery visible while preserving the child tree', async () => {
  window.history.replaceState(null, '', '/medical/review-groups/private');
  render(<ApiErrorHandler><Draft /></ApiErrorHandler>);
  await fail({ response: { status: 403 }, config: { method: 'get' } });
  expect(screen.getByRole('alertdialog')).toHaveTextContent('You are not authorized');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible(); expect(mount).toHaveBeenCalledTimes(1);
});
