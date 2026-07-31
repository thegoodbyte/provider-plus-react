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

const foodType = { _id: 'food', key: 'food-shopping', name: 'Food', category: 'food' };
const houseType = { _id: 'house', key: 'house-cost', name: 'House Cost', category: 'general' };
const julyRetreat = { _id: 'retreat-1', name: 'July retreat', code: 'JUL-25-26' };
const augustRetreat = { _id: 'retreat-2', name: 'August retreat', code: 'AUG-22-26' };

const expense = {
  _id: 'expense-1',
  expenseTypeId: foodType,
  retreatId: julyRetreat,
  amount: 125,
  currency: 'CZK',
  description: 'Ceremony fruit',
  vendor: 'Market',
  expenseDate: '2026-07-25T00:00:00.000Z',
  status: 'paid',
  expenseKind: 'actual',
};
const plannedExpense = {
  ...expense,
  _id: 'expense-2',
  expenseTypeId: houseType,
  retreatId: augustRetreat,
  description: 'August house deposit',
  vendor: 'Casa Jono',
  currency: 'EUR',
  status: 'planned',
  expenseKind: 'planned',
};
const companyExpense = {
  ...expense,
  _id: 'expense-3',
  retreatId: undefined,
  description: 'Office groceries',
  currency: 'PLN',
  status: 'approved',
};

describe('Expenses CRUD index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retreatExpensesApi.getAll as jest.Mock).mockResolvedValue({ data: [expense, plannedExpense, companyExpense] });
    (expenseTypesApi.getAll as jest.Mock).mockResolvedValue({ data: [foodType, houseType] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [julyRetreat, augustRetreat] });
    (retreatExpensesApi.delete as jest.Mock).mockResolvedValue({});
  });

  const renderPage = () => render(<ExpensesPage />);

  it('renders the expense grid and CRUD actions', async () => {
    renderPage();
    expect(await screen.findAllByText('Ceremony fruit')).not.toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'View expense' }).length).toBe(3);
    expect(screen.getAllByRole('button', { name: 'Edit expense' }).length).toBe(3);
    expect(screen.getAllByRole('button', { name: 'Delete expense' }).length).toBe(3);
  });

  it('uses an in-app confirmation before deleting', async () => {
    renderPage();
    await screen.findAllByText('Ceremony fruit');
    const expenseRow = screen.getAllByText('Ceremony fruit')[0].closest('tr');
    expect(expenseRow).not.toBeNull();
    await userEvent.click(within(expenseRow as HTMLElement).getByRole('button', { name: 'Delete expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete expense?' });
    expect(dialog).toBeInTheDocument();
    expect(retreatExpensesApi.delete).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(retreatExpensesApi.delete).toHaveBeenCalledWith('expense-1'));
  });

  it('shows direct business categories instead of legacy parent categories', async () => {
    renderPage();
    await screen.findAllByText('Ceremony fruit');
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
    expect(screen.getAllByText('House').length).toBeGreaterThan(0);
    expect(screen.queryByText('House Cost')).not.toBeInTheDocument();
  });

  it('combines retreat, category, status, kind and currency filters and clears them', async () => {
    renderPage();
    await screen.findAllByText('Ceremony fruit');

    await userEvent.selectOptions(screen.getByLabelText('Filter expenses by retreat'), 'retreat-2');
    expect(screen.getAllByText('August house deposit').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ceremony fruit')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter expenses by category'), 'house');
    await userEvent.selectOptions(screen.getByLabelText('Filter expenses by status'), 'planned');
    await userEvent.selectOptions(screen.getByLabelText('Filter planned or actual expenses'), 'planned');
    await userEvent.selectOptions(screen.getByLabelText('Filter expenses by currency'), 'EUR');
    expect(screen.getByText('1 of 3 expenses')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('3 of 3 expenses')).toBeInTheDocument();
    expect(screen.getAllByText('Ceremony fruit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Office groceries').length).toBeGreaterThan(0);
  });

  it('filters company expenses that are not attached to a retreat', async () => {
    renderPage();
    await screen.findAllByText('Office groceries');
    await userEvent.selectOptions(screen.getByLabelText('Filter expenses by retreat'), '__general__');
    expect(screen.getAllByText('Office groceries').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ceremony fruit')).not.toBeInTheDocument();
  });
});
