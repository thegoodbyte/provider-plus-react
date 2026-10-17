import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatStaffingPage from './RetreatStaffingPage';
import RetreatStaffSummary from './RetreatStaffSummary';
import { retreatsApi } from '../services/api';
jest.mock('../services/api', () => ({ retreatsApi: { getAll: jest.fn() } }));

it('aligns third helper columns across past/upcoming rows, search and section headings', async () => {
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    { _id: 'one', code: 'Upcoming', startDate: '2099-01-01', endDate: '2099-01-08', retreatStaff: [{ role: 'helper', name: 'First' }] },
    { _id: 'two', code: 'Past', startDate: '2020-01-01', endDate: '2020-01-08', retreatStaff: [{ role: 'third_helper', name: 'Third' }] },
  ] });
  render(<MemoryRouter><RetreatStaffingPage /></MemoryRouter>);
  await screen.findByRole('columnheader', { name: 'Helper 3' });
  expect(screen.getByText('Past retreats')).toHaveAttribute('colspan', '6');
  const row = screen.getByRole('link', { name: 'Past' }).closest('tr')!;
  expect(within(row).getAllByRole('cell')[4]).toHaveTextContent('Third');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First' } });
  expect(screen.queryByRole('link', { name: 'Past' })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Helper 3' })).toBeInTheDocument();
});

it('includes the third helper and a retreat-specific Add helper shortcut in the summary', () => {
  render(<MemoryRouter><RetreatStaffSummary assignments={[{ role: 'third_helper', name: 'Third' }]} retreatId="r1" routePrefix="staff" /></MemoryRouter>);
  expect(screen.getByText('Helper 3').nextElementSibling).toHaveTextContent('Third');
  expect(screen.getByRole('link', { name: 'Add helper' })).toHaveAttribute('href', '/staff/retreats/r1/helpers?add=helper');
});
