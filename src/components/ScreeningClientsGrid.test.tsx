import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ScreeningClientsGrid from './ScreeningClientsGrid';
import { clientsApi, notesApi } from '../services/api';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../services/api', () => ({
  clientsApi: {
    getAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notesApi: {
    getAll: jest.fn(),
  },
}));

describe('ScreeningClientsGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'client-1',
          firstName: 'Robert',
          lastName: 'Paulson',
          display_id: 1050,
          phone: '+1 555 987 6543',
          email: 'robert@example.com',
          workflowStatus: 'screening_scheduled',
          recreationalDrugs: 'History of crack use in 2018',
        },
        {
          _id: 'client-2',
          firstName: 'Sarah',
          lastName: 'Connor',
          display_id: 1051,
          phone: '+1 555 111 2222',
          email: 'sarah@example.com',
          workflowStatus: 'screening_scheduled',
          recreationalDrugs: 'None',
        },
      ],
    });
    (notesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders search input with screening placeholder', async () => {
    render(
      <BrowserRouter>
        <ScreeningClientsGrid />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search screening clients, screening info, notes/i)).toBeInTheDocument();
    });
  });

  it('filters clients by deep screening search term (e.g. crack) and displays snippet', async () => {
    render(
      <BrowserRouter>
        <ScreeningClientsGrid />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Robert Paulson')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search screening clients/i });
    fireEvent.change(searchInput, { target: { value: 'crack' } });

    await waitFor(() => {
      expect(screen.getByText('Robert Paulson')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Connor')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/crack/i)).toBeInTheDocument();
  });
});

const screeningRows = () => screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[1].textContent?.trim());
const client = (id: string, date?: string, extra: any = {}) => ({ _id: id, display_id: Number(id), firstName: 'Guest', lastName: id, workflowStatus: 'screening_scheduled', screeningData: date ? { screeningDate: date } : {}, ...extra });

test('shows recorded screening dates, prefers the form date and never substitutes completion or scheduled dates', async () => {
  const clients = [
    client('1', '2026-10-27', { screeningDate: '2026-12-01', screeningCompletedDate: '2027-01-01' }),
    client('2', undefined, { screeningDate: '2026-02-28T00:00:00.000Z' }),
    client('3', undefined, { screeningCompletedDate: '2026-10-26', screeningCallAt: '2026-10-28T15:00:00Z' }),
  ];
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: clients });
  (notesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<BrowserRouter><ScreeningClientsGrid /></BrowserRouter>);
  await screen.findByRole('button', { name: 'Screening date' });
  expect(document.querySelector('time[datetime="2026-10-27"]')).not.toBeNull();
  expect(document.querySelector('time[datetime="2026-02-28"]')).not.toBeNull();
  expect(document.querySelector('time[datetime="2026-12-01"]')).toBeNull();
  expect(screen.getByText('Not recorded')).toBeInTheDocument();
  expect(clientsApi.update).not.toHaveBeenCalled();
});

test('sorts newest and oldest while keeping missing/impossible dates last, ties stable and source records unchanged', async () => {
  const clients = [client('1','2026-10-20'),client('2',undefined),client('3','2026-10-27'),client('4','2026-02-30'),client('5','2026-10-27')];
  const before = JSON.stringify(clients);
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: clients });
  (notesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<BrowserRouter><ScreeningClientsGrid /></BrowserRouter>);
  const sort = await screen.findByRole('button',{ name: 'Screening date' });
  expect(screeningRows()).toEqual(['#3','#5','#1','#2','#4']);
  expect(screen.getByRole('columnheader',{name:'Screening date'})).toHaveAttribute('aria-sort','descending');
  fireEvent.click(sort);
  expect(screeningRows()).toEqual(['#1','#3','#5','#2','#4']);
  expect(screen.getByRole('columnheader',{name:'Screening date'})).toHaveAttribute('aria-sort','ascending');
  fireEvent.click(sort);
  expect(screeningRows()).toEqual(['#3','#5','#1','#2','#4']);
  expect(JSON.stringify(clients)).toBe(before);
});

test('retains date order through search and status filters and supports valid legacy fallback and leap days', async () => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    client('1','2024-02-29',{firstName:'Early',workflowStatus:'screened_accepted'}),
    client('2','invalid',{firstName:'Later',screeningDate:'2026-03-01',workflowStatus:'screened_accepted'}),
    client('3','2026-10-27',{firstName:'Scheduled'}),
  ] });
  (notesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<BrowserRouter><ScreeningClientsGrid /></BrowserRouter>);
  fireEvent.click(await screen.findByRole('button',{name:'Screening date'}));
  fireEvent.change(screen.getByLabelText('Screening status'),{target:{value:'screened_accepted'}});
  expect(screeningRows()).toEqual(['#1','#2']);
  fireEvent.change(screen.getByRole('textbox',{name:'Search screening clients'}),{target:{value:'Later'}});
  expect(screeningRows()).toEqual(['#2']);
  fireEvent.change(screen.getByRole('textbox',{name:'Search screening clients'}),{target:{value:''}});
  expect(screeningRows()).toEqual(['#1','#2']);
  expect(document.querySelector('time[datetime="2024-02-29"]')).not.toBeNull();
});
