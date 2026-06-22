import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpensesPage from './ExpensesPage';
import { expenseTypesApi, retreatExpensesApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  expenseTypesApi: {
    getAll: jest.fn(),
  },
  retreatExpensesApi: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  retreatsApi: {
    getAll: jest.fn(),
  },
}));

const benRetreat = {
  _id: 'retreat-ben',
  name: 'June retreat',
  code: 'BEN-06-17-26',
  retreatCode: 'BEN-06-17-26',
  location: 'Default Location',
};

const otherRetreat = {
  _id: 'retreat-other',
  name: 'Other retreat',
  code: 'JNO-07-25-26',
  retreatCode: 'JNO-07-25-26',
  location: 'Default Location',
};

const expenseType = {
  _id: 'expense-type-food',
  name: 'Food',
  description: 'Food supplies',
  category: 'food',
  isActive: true,
};

const setupMocks = (expenses: any[]) => {
  (retreatExpensesApi.getAll as jest.Mock).mockResolvedValue({ data: expenses });
  (expenseTypesApi.getAll as jest.Mock).mockResolvedValue({ data: [expenseType] });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [benRetreat, otherRetreat] });
};

const waitForLoadedExpenses = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/loading expenses/i)).not.toBeInTheDocument();
  });
};

describe('ExpensesPage retreat filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps expenses visible when the API returns retreatId as a populated retreat object', async () => {
    setupMocks([
      {
        _id: 'expense-ben',
        retreatId: benRetreat,
        expenseTypeId: expenseType,
        amount: 125,
        currency: 'USD',
        description: 'BEN supplies',
        vendor: 'Market',
        expenseDate: '2026-06-20T00:00:00.000Z',
        status: 'paid',
      },
      {
        _id: 'expense-other',
        retreatId: otherRetreat,
        expenseTypeId: expenseType,
        amount: 90,
        currency: 'USD',
        description: 'Other supplies',
        vendor: 'Market',
        expenseDate: '2026-07-20T00:00:00.000Z',
        status: 'paid',
      },
    ]);

    render(<ExpensesPage />);
    await waitForLoadedExpenses();

    await userEvent.selectOptions(screen.getByDisplayValue('All Retreats'), 'retreat-ben');

    const rows = screen.getAllByRole('row');
    const bodyRows = rows.slice(1);
    expect(bodyRows).toHaveLength(1);
    expect(within(bodyRows[0]).getByText('BEN supplies')).toBeInTheDocument();
    expect(within(bodyRows[0]).getByText('BEN-06-17-26')).toBeInTheDocument();
    expect(screen.queryByText('Other supplies')).not.toBeInTheDocument();
  });

  it('keeps older expenses visible when retreatId was saved as the retreat code string', async () => {
    setupMocks([
      {
        _id: 'expense-ben-legacy',
        retreatId: 'BEN-06-17-26',
        expenseTypeId: expenseType,
        amount: 45,
        currency: 'USD',
        description: 'Legacy BEN supplies',
        vendor: 'Market',
        expenseDate: '2026-06-20T00:00:00.000Z',
        status: 'paid',
      },
    ]);

    render(<ExpensesPage />);
    await waitForLoadedExpenses();

    await userEvent.selectOptions(screen.getByDisplayValue('All Retreats'), 'retreat-ben');

    const legacyRow = screen.getByText('Legacy BEN supplies').closest('tr');
    expect(legacyRow).toBeTruthy();
    expect(within(legacyRow as HTMLTableRowElement).getByText('BEN-06-17-26')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(within(screen.getByText('Total Expenses').closest('.bg-white') as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
