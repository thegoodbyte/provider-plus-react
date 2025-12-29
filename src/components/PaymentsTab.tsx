import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { paymentsApi } from '../services/api';
import { Payment, PaymentSummary } from '../types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface PaymentsTabProps {
  retreatId: string;
}

interface PaymentFormData {
  clientId: string;
  bookingId?: string;
  amount: number;
  currency: 'CZK' | 'EUR' | 'PLN';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'other';
  description?: string;
  transactionId?: string;
  paymentDate: string;
  notes?: string;
  isDeposit: boolean;
  isFinalPayment: boolean;
  exchangeRate?: number;
}

const PaymentsTab: React.FC<PaymentsTabProps> = ({ retreatId }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState<PaymentFormData>({
    clientId: '',
    amount: 0,
    currency: 'EUR',
    status: 'pending',
    paymentMethod: 'bank_transfer',
    description: '',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    isDeposit: false,
    isFinalPayment: false
  });
  const gridApiRef = useRef<GridApi | null>(null);

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value?.toLowerCase() || 'pending';
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${params.value || 'Pending'}</span>`;
  };

  const AmountCellRenderer = (params: ICellRendererParams) => {
    const amount = params.value || 0;
    const currency = params.data.currency || 'EUR';
    const amountEUR = params.data.amountInEUR || amount;

    if (currency === 'EUR') {
      return `€${amount.toLocaleString()}`;
    }

    return `${amount.toLocaleString()} ${currency} (€${amountEUR.toLocaleString()})`;
  };

  const PaymentMethodCellRenderer = (params: ICellRendererParams) => {
    const methodIcons = {
      bank_transfer: '🏦',
      card: '💳',
      cash: '💵',
      paypal: '🌐',
      crypto: '₿',
      other: '📄'
    };

    const method = params.value;
    const icon = methodIcons[method as keyof typeof methodIcons] || '📄';
    const displayName = method?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || '';

    return `${icon} ${displayName}`;
  };

  const TypeCellRenderer = (params: ICellRendererParams) => {
    const isDeposit = params.data.isDeposit;
    const isFinalPayment = params.data.isFinalPayment;

    if (isDeposit) return '🏠 Deposit';
    if (isFinalPayment) return '✅ Final Payment';
    return '💰 Payment';
  };

  const ActionsCellRenderer = (params: ICellRendererParams) => {
    return `
      <div class="cell-actions">
        <button class="edit-btn" data-action="edit" data-id="${params.data._id}">✏️</button>
        <button class="delete-btn" data-action="delete" data-id="${params.data._id}">🗑️</button>
        ${params.data.status === 'completed' ? `<button class="refund-btn" data-action="refund" data-id="${params.data._id}">↩️</button>` : ''}
      </div>
    `;
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'Client',
      field: 'clientId.firstName',
      width: 150,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' },
      valueGetter: (params) => {
        const client = params.data.clientId;
        return typeof client === 'object' ? `${client.firstName} ${client.lastName}` : '';
      }
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 150,
      cellRenderer: AmountCellRenderer
    },
    {
      headerName: 'Type',
      width: 120,
      cellRenderer: TypeCellRenderer
    },
    {
      headerName: 'Method',
      field: 'paymentMethod',
      width: 130,
      cellRenderer: PaymentMethodCellRenderer
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 120,
      cellRenderer: StatusCellRenderer
    },
    {
      headerName: 'Description',
      field: 'description',
      width: 200
    },
    {
      headerName: 'Transaction ID',
      field: 'transactionId',
      width: 150
    },
    {
      headerName: 'Payment Date',
      field: 'paymentDate',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      }
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false
    }
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsResponse, summaryResponse] = await Promise.all([
        paymentsApi.getByRetreat(retreatId),
        paymentsApi.getRetreatSummary(retreatId)
      ]);

      setPayments(paymentsResponse.data);
      setSummary(summaryResponse.data);
    } catch (error) {
      console.error('Error fetching payments data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const handleDeletePayment = useCallback(async (paymentId: string) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentsApi.delete(paymentId);
        await fetchData();
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  }, [fetchData]);

  const onCellClicked = useCallback((event: any) => {
    const target = event.event?.target;
    if (target?.dataset?.action === 'edit') {
      const paymentId = target.dataset.id;
      const payment = payments.find(p => p._id === paymentId);
      if (payment) {
        setEditingPayment(payment);
        setFormData({
          clientId: typeof payment.clientId === 'string' ? payment.clientId : payment.clientId._id || '',
          bookingId: typeof payment.bookingId === 'string' ? payment.bookingId : payment.bookingId?._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          description: payment.description || '',
          transactionId: payment.transactionId || '',
          paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
          notes: payment.notes || '',
          isDeposit: payment.isDeposit,
          isFinalPayment: payment.isFinalPayment,
          exchangeRate: payment.exchangeRate
        });
        setShowAddForm(true);
      }
    } else if (target?.dataset?.action === 'delete') {
      const paymentId = target.dataset.id;
      handleDeletePayment(paymentId);
    } else if (target?.dataset?.action === 'refund') {
      const paymentId = target.dataset.id;
      handleRefund(paymentId);
    }
  }, [payments, handleDeletePayment]);

  const handleRefund = async (paymentId: string) => {
    const payment = payments.find(p => p._id === paymentId);
    if (!payment) return;

    const refundAmount = prompt(`Enter refund amount (max: ${payment.amount} ${payment.currency}):`);
    if (refundAmount && !isNaN(Number(refundAmount))) {
      try {
        await paymentsApi.processRefund(paymentId, Number(refundAmount));
        await fetchData();
      } catch (error) {
        console.error('Error processing refund:', error);
        alert('Error processing refund');
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        retreatId,
        paymentDate: new Date(formData.paymentDate)
      };

      if (editingPayment) {
        await paymentsApi.update(editingPayment._id!, submitData);
      } else {
        await paymentsApi.create(submitData);
      }

      setShowAddForm(false);
      setEditingPayment(null);
      setFormData({
        clientId: '',
        amount: 0,
        currency: 'EUR',
        status: 'pending',
        paymentMethod: 'bank_transfer',
        description: '',
        transactionId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: '',
        isDeposit: false,
        isFinalPayment: false
      });
      await fetchData();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">💰</div>
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="payments-tab">
      {/* Summary Cards */}
      {summary && (
        <div className="payments-summary">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-number">€{summary.completedPaymentsEUR.toLocaleString()}</div>
              <div className="summary-label">Completed Payments</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">€{summary.pendingPaymentsEUR.toLocaleString()}</div>
              <div className="summary-label">Pending Payments</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">€{summary.depositsEUR.toLocaleString()}</div>
              <div className="summary-label">Deposits</div>
            </div>
            <div className="summary-card">
              <div className="summary-number">€{summary.finalPaymentsEUR.toLocaleString()}</div>
              <div className="summary-label">Final Payments</div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="method-breakdown">
            <h4>💳 By Payment Method</h4>
            <div className="method-list">
              {Object.entries(summary.paymentsByMethod).map(([method, amount]) => (
                <div key={method} className="method-item">
                  <span className="method-name">{method.replace('_', ' ')}</span>
                  <span className="method-amount">€{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="payments-actions">
        <button
          onClick={() => setShowAddForm(true)}
          className="add-btn"
          disabled={showAddForm}
        >
          ➕ Record Payment
        </button>
        <button onClick={fetchData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="payment-form">
          <h3>{editingPayment ? 'Edit Payment' : 'Record New Payment'}</h3>
          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value as 'CZK' | 'EUR' | 'PLN'})}
                >
                  <option value="EUR">EUR</option>
                  <option value="CZK">CZK</option>
                  <option value="PLN">PLN</option>
                </select>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Transaction ID</label>
                <input
                  type="text"
                  value={formData.transactionId}
                  onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isDeposit}
                    onChange={(e) => setFormData({...formData, isDeposit: e.target.checked})}
                  />
                  This is a deposit
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isFinalPayment}
                    onChange={(e) => setFormData({...formData, isFinalPayment: e.target.checked})}
                  />
                  This is a final payment
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn">
                {editingPayment ? 'Update Payment' : 'Record Payment'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingPayment(null);
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments Grid */}
      <div className="payments-grid">
        <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
          <AgGridReact
            rowData={payments}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onCellClicked={onCellClicked}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            pagination={true}
            paginationPageSize={15}
            enableBrowserTooltips={true}
            headerHeight={40}
            rowHeight={45}
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentsTab;