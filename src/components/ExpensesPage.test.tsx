import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpensesPage from './ExpensesPage';
import { expenseTypesApi, retreatExpensesApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  expenseTypesApi: { getAll: jest.fn() },
  retreatExpensesApi: { getAll: jest.fn(), delete: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/admin/expenses' }),
}), { virtual: true });

const expense = {
  _id: 'expense-1',
  expenseTypeId: { _id: 'food', name: 'Food', category: 'food' },
  retreatId: { _id: 'retreat-1', name: 'July retreat', code: 'JUL-25-26' },
  amount: 125,
  currency: 'CZK',
  description: 'Ceremony fruit',
  vendor: 'Market',
  expenseDate: '2026-07-25T00:00:00.000Z',
  status: 'paid',
};

describe('Expenses CRUD index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retreatExpensesApi.getAll as jest.Mock).mockResolvedValue({ data: [expense] });
    (expenseTypesApi.getAll as jest.Mock).mockResolvedValue({ data: [expense.expenseTypeId] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [expense.retreatId] });
    (retreatExpensesApi.delete as jest.Mock).mockResolvedValue({});
  });

  const renderPage = () => render(<ExpensesPage />);

  it('renders the expense grid and CRUD actions', async () => {
    renderPage();
    expect(await screen.findAllByText('Ceremony fruit')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'View expense' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete expense' })).toBeInTheDocument();
  });

  it('uses an in-app confirmation before deleting', async () => {
    renderPage();
    await screen.findAllByText('Ceremony fruit');
    await userEvent.click(screen.getByRole('button', { name: 'Delete expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete expense?' });
    expect(dialog).toBeInTheDocument();
    expect(retreatExpensesApi.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(retreatExpensesApi.delete).toHaveBeenCalledWith('expense-1'));
  });
});
