import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExpenseReceiptItems from './ExpenseReceiptItems';
import { retreatExpensesApi } from '../services/api';
jest.mock('../services/api', () => ({ retreatExpensesApi: { getDetailItems: jest.fn(), itemizeReceipt: jest.fn() } }));
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const result = { status: 'completed', error: '', summary: { currency: 'CZK', paymentMethod: 'cash', totalAmount: 20, taxAmount: 2, itemTotal: 20, warnings: [] }, items: [{ _id: 'i1', name: 'Apples', quantity: 2, unitPrice: 10, amount: 20, taxAmount: null, taxRate: null }] };
beforeEach(() => { (retreatExpensesApi.getDetailItems as jest.Mock).mockResolvedValue({ data: result }); });
it('shows items, receipt-level tax and payment method without inventing per-item tax', async () => {
  render(<ExpenseReceiptItems expenseId="e1" currency="CZK" />);
  expect(await screen.findByText('Apples')).toBeInTheDocument(); expect(screen.getByText('cash')).toBeInTheDocument(); expect(screen.getAllByText('Not shown')).toHaveLength(2);
  expect(retreatExpensesApi.getDetailItems).toHaveBeenCalledWith('e1');
});
it('itemizes existing receipts explicitly and displays the returned items', async () => {
  (retreatExpensesApi.getDetailItems as jest.Mock).mockResolvedValue({ data: { status: 'not_started', error: '', summary: null, items: [] } });
  (retreatExpensesApi.itemizeReceipt as jest.Mock).mockResolvedValue({ data: result });
  render(<ExpenseReceiptItems expenseId="e1" currency="CZK" />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Itemize receipt' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Itemize receipt' }));
  expect(await screen.findByText('Apples')).toBeInTheDocument(); expect(retreatExpensesApi.itemizeReceipt).toHaveBeenCalledWith('e1');
});
it('keeps the retry action available after provider failure', async () => {
  (retreatExpensesApi.getDetailItems as jest.Mock).mockResolvedValue({ data: { status: 'failed', error: 'Receipt unreadable. Your receipt is saved.', items: [], summary: null } });
  render(<ExpenseReceiptItems expenseId="e1" currency="CZK" />);
  expect(await screen.findByText('Receipt unreadable. Your receipt is saved.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Itemize receipt' })).not.toBeDisabled();
});
it('warns when extracted totals differ from the expense', async () => {
  (retreatExpensesApi.getDetailItems as jest.Mock).mockResolvedValue({ data: { ...result, summary: { ...result.summary, warnings: ['Printed total differs from expense.'] } } });
  render(<ExpenseReceiptItems expenseId="e1" currency="CZK" />); expect(await screen.findByText('Printed total differs from expense.')).toBeInTheDocument();
});
