import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import ScratchpadOverview, { scratchpadDateRange } from './ScratchpadOverview';
const filters = { from: '', to: '', provider: '', account: '', currency: '', search: '', status: 'converted', sort: 'date-desc' };
const snapshot: any = { refreshedAt: '2026-10-26T10:00:00Z', totals: [
  { currency: 'CZK', status: 'logged', amount: '56700.00', count: 3 },
  { currency: 'CZK', status: 'converted', amount: '56700.00', count: 3 },
  { currency: 'EUR', status: 'logged', amount: '100.00', count: 1 },
] };
it('uses inclusive local calendar dates across month, year and leap boundaries', () => {
  expect(scratchpadDateRange('All time')).toEqual({ from: '', to: '' });
  expect(scratchpadDateRange('Today', new Date(2026, 0, 1, 0, 15))).toEqual({ from: '2026-01-01', to: '2026-01-01' });
  expect(scratchpadDateRange('7 days', new Date(2026, 0, 3))).toEqual({ from: '2025-12-28', to: '2026-01-03' });
  expect(scratchpadDateRange('30 days', new Date(2024, 2, 1))).toEqual({ from: '2024-02-01', to: '2024-03-01' });
});
it('preserves unrelated filters when selecting a date shortcut and supports custom dates', () => {
  const onChange = jest.fn();
  render(<ScratchpadOverview filters={{ ...filters, provider: 'csob', search: 'SP-123' }} onChange={onChange} onClear={jest.fn()} snapshot={snapshot} loading={false} error="" />);
  fireEvent.click(screen.getByRole('button', { name: '7 days', exact: true }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'csob', search: 'SP-123', status: 'converted', ...scratchpadDateRange('7 days') }));
  fireEvent.click(screen.getByRole('button', { name: 'Custom', exact: true }));
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-01' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-01', provider: 'csob' }));
});
it('shows URL custom ranges and never mixes currencies or recomputes totals from rows', async () => {
  render(<ScratchpadOverview filters={{ ...filters, from: '2020-01-01' }} onChange={jest.fn()} onClear={jest.fn()} snapshot={snapshot} loading={false} error="" />);
  expect(screen.getByLabelText('From date')).toHaveValue('2020-01-01');
  expect(screen.queryByRole('table', { name: 'Totals by currency and status' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'View totals'}));
  await waitFor(()=>expect(screen.getByRole('dialog')).toBeVisible());
  const table = screen.getByRole('table', { name: 'Totals by currency and status' });
  const rows = within(table).getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(rows[1]).toHaveTextContent('CZK'); expect(rows[1]).toHaveTextContent('56,700.00');
  expect(rows[2]).toHaveTextContent('EUR'); expect(rows[2]).toHaveTextContent('100.00');
  expect(rows[2]).not.toHaveTextContent('56,700.00');
  fireEvent.click(screen.getByText('How totals work'));
  expect(screen.getByText(/independently of the status tab/)).toBeVisible();
});
it('focuses search with slash without stealing typing from another input', () => {
  render(<ScratchpadOverview filters={filters} onChange={jest.fn()} onClear={jest.fn()} snapshot={snapshot} loading={false} error="" />);
  fireEvent.keyDown(window, { key: '/' });
  expect(screen.getByLabelText('Search payer, phone, transaction or request number')).toHaveFocus();
  const account = screen.getByLabelText('Filter account'); account.focus(); fireEvent.keyDown(account, { key: '/' });
  expect(account).toHaveFocus();
});

it('opens totals without changing filters or data and closes through its footer', async () => {
 const change=jest.fn(),clear=jest.fn();render(<ScratchpadOverview filters={filters} onChange={change} onClear={clear} snapshot={snapshot} loading={false} error=""/>);
 const trigger=screen.getByRole('button',{name:'View totals'});fireEvent.click(trigger);await waitFor(()=>expect(screen.getByRole('dialog',{name:'Scratchpad totals'})).toBeVisible());expect(change).not.toHaveBeenCalled();expect(clear).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Close totals'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('keeps previous snapshot totals visibly marked stale and disables the trigger before the first snapshot', () => {
 const {rerender}=render(<ScratchpadOverview filters={filters} onChange={jest.fn()} onClear={jest.fn()} snapshot={null} loading={true} error=""/>);
 expect(screen.getByRole('button',{name:'View totals'})).toBeDisabled();rerender(<ScratchpadOverview filters={filters} onChange={jest.fn()} onClear={jest.fn()} snapshot={snapshot} loading={false} error="Refresh failed"/>);
 fireEvent.click(screen.getByRole('button',{name:'View totals'}));const dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('status')).toHaveTextContent('may not match the current filters');expect(within(dialog).getAllByText('56,700.00')[0]).toBeInTheDocument();
});
