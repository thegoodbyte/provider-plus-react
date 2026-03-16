import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { paymentsApi, clientsApi, retreatsApi } from '../services/api';
import { Payment, Client, Retreat } from '../types';
import CurrencyDisplay from './CurrencyDisplay';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ClientsGrid.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface PaymentWithDetails {
  _id?: string;
  amount: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other';
  paymentType?: 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment';
  description?: string;
  transactionId?: string;
  transactionReference?: string;
  paymentDate: Date | string;
  notes?: string;
  isDeposit: boolean;
  isFinalPayment: boolean;
  isRefundable?: boolean;
  refundedAmount?: number;
  processedBy?: string;
  amountInEUR?: number;
  clientId: string | undefined;
  retreatId: string | undefined;
  clientName?: string;
  retreatName?: string;
  createdAt?: string;
}

const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    retreatId: '',
    amount: 0,
    currency: 'EUR' as 'EUR' | 'USD' | 'CZK' | 'PLN',
    status: 'pending' as 'pending' | 'completed' | 'failed' | 'refunded',
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'card' | 'cash' | 'paypal' | 'crypto' | 'stripe' | 'wise' | 'revolut' | 'other',
    paymentType: 'regular_payment' as 'deposit_non_refundable' | 'deposit_refundable' | 'regular_payment' | 'balance_payment' | 'refund' | 'adjustment',
    description: '',
    transactionId: '',
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    isDeposit: false,
    isFinalPayment: false,
    isRefundable: true
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const gridApiRef = useRef<GridApi | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsResponse, clientsResponse, retreatsResponse] = await Promise.all([
        paymentsApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll()
      ]);

      const clientsMap = new Map<string, Client>(clientsResponse.data.filter((client: Client) => client._id).map((client: Client) => [client._id!, client]));
      const retreatsMap = new Map<string, Retreat>(retreatsResponse.data.filter((retreat: Retreat) => retreat._id).map((retreat: Retreat) => [retreat._id!, retreat]));

      const enrichedPayments: PaymentWithDetails[] = paymentsResponse.data.map((payment: Payment) => {
        const clientId = typeof payment.clientId === 'string' ? payment.clientId : payment.clientId._id;
        const retreatId = typeof payment.retreatId === 'string' ? payment.retreatId : payment.retreatId._id;

        const client = clientId ? clientsMap.get(clientId) : undefined;
        const retreat = retreatId ? retreatsMap.get(retreatId) : undefined;

        return {
          ...payment,
          clientId,
          retreatId,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          retreatName: retreat ? retreat.name : 'Unknown Retreat'
        };
      });

      setPayments(enrichedPayments);
      setClients(clientsResponse.data);
      setRetreats(retreatsResponse.data);

      console.log('Payments data:', paymentsResponse.data);
      console.log('Clients data:', clientsResponse.data);
      console.log('Retreats data:', retreatsResponse.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const StatusCellRenderer = (params: ICellRendererParams) => {
    const status = params.value?.toLowerCase() || 'pending';
    const statusClass = `status-${status}`;
    return `<span class="status-badge ${statusClass}">${params.value || 'Pending'}</span>`;
  };

  const AmountCellRenderer = (params: ICellRendererParams) => {
    const amount = params.value || 0;
    const currency = params.data.currency || 'EUR';

    // For now, use simple currency formatting - the USD conversion will happen in background
    const symbols: { [key: string]: string } = {
      EUR: '€',
      USD: '$',
      CZK: 'Kč',
      PLN: 'zł'
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const PaymentMethodCellRenderer = (params: ICellRendererParams) => {
    const methodIcons = {
      bank_transfer: '🏦',
      card: '💳',
      cash: '💵',
      paypal: '🅿️',
      crypto: '₿',
      stripe: '💳',
      wise: '🌐',
      revolut: '🔄',
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
    const id = params.data._id || '';
    return `
      <div class="cell-actions">
        <button class="edit-btn" data-action="edit" data-id="${id}">✏️</button>
        <button class="delete-btn" data-action="delete" data-id="${id}">🗑️</button>
        ${params.data.status === 'completed' ? `<button class="refund-btn" data-action="refund" data-id="${id}">↩️</button>` : ''}
      </div>
    `;
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'Client',
      field: 'clientName',
      width: 150,
      pinned: 'left',
      cellStyle: { fontWeight: 'bold' }
    },
    {
      headerName: 'Retreat',
      field: 'retreatName',
      width: 150
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
      headerName: 'Payment Date',
      field: 'paymentDate',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      }
    },
    {
      headerName: 'Transaction ID',
      field: 'transactionId',
      width: 150
    },
    {
      headerName: 'Description',
      field: 'description',
      width: 200,
      flex: 1
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      pinned: 'right'
    }
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }, []);

  const onCellClicked = useCallback((event: any) => {
    const target = event.event?.target;
    if (target?.dataset?.action === 'edit') {
      const paymentId = target.dataset.id;
      const payment = payments.find(p => p._id === paymentId);
      if (payment) {
        setEditingPayment(payment);
        setFormData({
          clientId: payment.clientId || '',
          retreatId: payment.retreatId || '',
          amount: payment.amount,
          currency: payment.currency as 'EUR' | 'USD' | 'CZK' | 'PLN',
          status: payment.status,
          paymentMethod: payment.paymentMethod as typeof formData.paymentMethod,
          paymentType: payment.paymentType || 'regular_payment',
          description: payment.description || '',
          transactionId: payment.transactionId || '',
          transactionReference: payment.transactionReference || '',
          paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
          notes: payment.notes || '',
          isDeposit: payment.isDeposit,
          isFinalPayment: payment.isFinalPayment,
          isRefundable: payment.isRefundable || true
        });
        setShowAddForm(true);
      }
    } else if (target?.dataset?.action === 'delete') {
      const paymentId = target.dataset.id;
      handleDeletePayment(paymentId);
    } else if (target?.dataset?.action === 'refund') {
      const paymentId = target.dataset.id;
      handleRefundPayment(paymentId);
    }
  }, [payments]);

  const handleDeletePayment = async (paymentId: string) => {
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await paymentsApi.delete(paymentId);
        await fetchPayments();
      } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment');
      }
    }
  };

  const handleRefundPayment = async (paymentId: string) => {
    const payment = payments.find(p => p._id === paymentId);
    if (!payment) return;

    const refundAmount = prompt(`Enter refund amount (max: ${payment.amount} ${payment.currency}):`);
    if (refundAmount && !isNaN(Number(refundAmount))) {
      try {
        await paymentsApi.processRefund(paymentId, Number(refundAmount));
        await fetchPayments();
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
        paymentDate: new Date(formData.paymentDate)
      };

      if (editingPayment && editingPayment._id) {
        await paymentsApi.update(editingPayment._id, submitData);
      } else {
        await paymentsApi.create(submitData);
      }

      setShowAddForm(false);
      setEditingPayment(null);
      setFormData({
        clientId: '',
        retreatId: '',
        amount: 0,
        currency: 'EUR',
        status: 'pending',
        paymentMethod: 'bank_transfer',
        paymentType: 'regular_payment',
        description: '',
        transactionId: '',
        transactionReference: '',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: '',
        isDeposit: false,
        isFinalPayment: false,
        isRefundable: true
      });
      await fetchPayments();
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Error saving payment');
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">💰</div>
        <p>Loading payments...</p>
      </div>
    );
  }

  // For now, let's show the total in EUR (we can make this configurable later)
  const totalAmount = payments.reduce((sum, payment) => {
    if (payment.status === 'completed') {
      // Simple approximation - in real app we'd convert properly
      const eurAmount = payment.currency === 'EUR' ? payment.amount :
                       payment.currency === 'USD' ? payment.amount * 0.85 :
                       payment.currency === 'CZK' ? payment.amount * 0.04 :
                       payment.currency === 'PLN' ? payment.amount * 0.22 :
                       payment.amount;
      return sum + eurAmount;
    }
    return sum;
  }, 0);

  return (
    <div className="payments-page-container">
      <div className="payments-header">
        <h2>💰 Payments Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="add-btn"
          disabled={showAddForm}
        >
          ➕ Record Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="payments-summary">
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-number">
              <CurrencyDisplay amount={totalAmount} currency="EUR" />
            </div>
            <div className="summary-label">Total Completed (approx)</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{payments.filter(p => p.status === 'pending').length}</div>
            <div className="summary-label">Pending</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{payments.filter(p => p.isDeposit).length}</div>
            <div className="summary-label">Deposits</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{payments.length}</div>
            <div className="summary-label">Total Payments</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingPayment ? 'Edit Payment' : 'Record New Payment'}</h3>
            <form onSubmit={handleFormSubmit}>
              <div className="payment-form-grid">
                <div className="form-group">
                  <label htmlFor="payment-client">Client *</label>
                  <select
                    id="payment-client"
                    value={formData.clientId}
                    onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                    required
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client._id} value={client._id}>
                        {client.firstName} {client.lastName} ({client.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-retreat">Retreat *</label>
                  <select
                    id="payment-retreat"
                    value={formData.retreatId}
                    onChange={(e) => setFormData({...formData, retreatId: e.target.value})}
                    required
                  >
                    <option value="">Select a retreat...</option>
                    {retreats.map((retreat) => (
                      <option key={retreat._id} value={retreat._id}>
                        {retreat.name} - {retreat.location}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-amount">Amount *</label>
                  <input
                    type="number"
                    id="payment-amount"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    required
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payment-currency">Currency</label>
                  <select
                    id="payment-currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value as any})}
                  >
                    <option value="EUR">EUR (Euro)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="CZK">CZK (Czech Koruna)</option>
                    <option value="PLN">PLN (Polish Złoty)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-method">Payment Method</label>
                  <select
                    id="payment-method"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                  >
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card/Credit Card</option>
                    <option value="stripe">💳 Stripe</option>
                    <option value="paypal">🅿️ PayPal</option>
                    <option value="wise">🌐 Wise (TransferWise)</option>
                    <option value="revolut">🔄 Revolut</option>
                    <option value="crypto">₿ Cryptocurrency</option>
                    <option value="other">🔧 Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-type">Payment Type</label>
                  <select
                    id="payment-type"
                    value={formData.paymentType}
                    onChange={(e) => setFormData({...formData, paymentType: e.target.value as any})}
                  >
                    <option value="deposit_non_refundable">💰 Deposit (Non-Refundable)</option>
                    <option value="deposit_refundable">💳 Deposit (Refundable)</option>
                    <option value="regular_payment">💵 Regular Payment</option>
                    <option value="balance_payment">⚖️ Balance Payment</option>
                    <option value="adjustment">🔧 Adjustment</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-status">Status</label>
                  <select
                    id="payment-status"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payment-date">Payment Date *</label>
                  <input
                    type="date"
                    id="payment-date"
                    value={formData.paymentDate}
                    onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payment-transaction-id">Transaction ID</label>
                  <input
                    type="text"
                    id="payment-transaction-id"
                    value={formData.transactionId}
                    onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
                    placeholder="e.g., TXN123456789"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payment-transaction-reference">Transaction Reference</label>
                  <input
                    type="text"
                    id="payment-transaction-reference"
                    value={formData.transactionReference}
                    onChange={(e) => setFormData({...formData, transactionReference: e.target.value})}
                    placeholder="e.g., REF123456"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="payment-description">Description</label>
                  <input
                    type="text"
                    id="payment-description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="e.g., Retreat deposit payment"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="payment-notes">Notes</label>
                  <textarea
                    id="payment-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    placeholder="Additional notes about this payment..."
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

              <div className="form-buttons">
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
        </div>
      )}

      {/* Payments Grid */}
      <div className="payments-grid">
        <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={payments}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            onCellClicked={onCellClicked}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            pagination={true}
            paginationPageSize={20}
            enableBrowserTooltips={true}
            headerHeight={40}
            rowHeight={45}
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;