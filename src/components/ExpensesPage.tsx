import React, { useState, useEffect } from 'react';
import { retreatExpensesApi, expenseTypesApi, retreatsApi } from '../services/api';
import { RetreatExpense, ExpenseType, Retreat } from '../types';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiDollarSign, FiCalendar, FiTag, FiFilter } from 'react-icons/fi';

// Icon wrapper component for consistent icon rendering
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const getRetreatCode = (retreat?: Retreat | null) => {
  if (!retreat) return '';
  return String(retreat.code || retreat.retreatCode || retreat.name || 'Unknown Retreat').trim();
};

type RetreatReference = string | (Partial<Retreat> & { _id?: string }) | null | undefined;

const getRetreatReferenceId = (retreatRef: RetreatReference) => {
  if (!retreatRef) return '';
  if (typeof retreatRef === 'string') return retreatRef;
  return String(retreatRef._id || '').trim();
};

const getRetreatReferenceCode = (retreatRef: RetreatReference) => {
  if (!retreatRef || typeof retreatRef === 'string') return '';
  return getRetreatCode(retreatRef as Retreat);
};

const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<RetreatExpense[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RetreatExpense | null>(null);
  const [filterRetreatId, setFilterRetreatId] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'retreat' | 'general'>('all');

  // Form state
  const [formData, setFormData] = useState<Partial<RetreatExpense> & { expenseDate?: string }>({
    amount: 0,
    currency: 'EUR',
    description: '',
    vendor: '',
    expenseDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    retreatId: '',
    expenseTypeId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [expensesRes, typesRes, retreatsRes] = await Promise.all([
        retreatExpensesApi.getAll(),
        expenseTypesApi.getAll(),
        retreatsApi.getAll()
      ]);

      setExpenses(expensesRes.data);
      setExpenseTypes(typesRes.data);
      setRetreats(retreatsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense?._id) {
        await retreatExpensesApi.update(editingExpense._id, formData);
      } else {
        await retreatExpensesApi.create(formData as Omit<RetreatExpense, '_id'>);
      }

      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await retreatExpensesApi.delete(id);
        await fetchData();
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense');
      }
    }
  };

  const handleEdit = (expense: RetreatExpense) => {
    setEditingExpense(expense);
    setFormData({
      amount: expense.amount,
      currency: expense.currency,
      description: expense.description,
      vendor: expense.vendor,
      expenseDate: typeof expense.expenseDate === 'string'
        ? expense.expenseDate.split('T')[0]
        : new Date(expense.expenseDate).toISOString().split('T')[0],
      status: expense.status,
      retreatId: getRetreatReferenceId(expense.retreatId as RetreatReference),
      expenseTypeId: typeof expense.expenseTypeId === 'object' ? expense.expenseTypeId._id! : expense.expenseTypeId
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      amount: 0,
      currency: 'EUR',
      description: '',
      vendor: '',
      expenseDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      retreatId: '',
      expenseTypeId: ''
    });
    setEditingExpense(null);
    setShowAddForm(false);
  };

  const getExpenseTypeName = (typeId: string | ExpenseType) => {
    if (typeof typeId === 'object') return typeId.name;
    const type = expenseTypes.find(t => t._id === typeId);
    return type?.name || 'Unknown';
  };

  const getRetreatName = (retreatRef: RetreatReference) => {
    const retreatId = getRetreatReferenceId(retreatRef);
    if (!retreatId) return getRetreatReferenceCode(retreatRef) || 'General Company Expense';
    const retreat = retreats.find(r => r._id === retreatId);
    return getRetreatCode(retreat) || getRetreatReferenceCode(retreatRef) || retreatId;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Filter expenses based on selected filters
  const filteredExpenses = expenses.filter(expense => {
    const expenseRetreatRef = expense.retreatId as RetreatReference;
    const expenseRetreatId = getRetreatReferenceId(expenseRetreatRef);
    const expenseRetreatCode = getRetreatReferenceCode(expenseRetreatRef);
    const hasRetreat = Boolean(expenseRetreatId || expenseRetreatCode);

    if (filterType === 'retreat' && !hasRetreat) return false;
    if (filterType === 'general' && hasRetreat) return false;

    if (filterRetreatId) {
      const selectedRetreat = retreats.find((retreat) => retreat._id === filterRetreatId);
      const selectedRetreatCode = getRetreatCode(selectedRetreat);
      const selectedRetreatName = selectedRetreat?.name?.trim() || '';
      const matchesId = expenseRetreatId === filterRetreatId;
      const matchesCode = Boolean(selectedRetreatCode && expenseRetreatCode && selectedRetreatCode === expenseRetreatCode);
      const matchesLegacyString = typeof expenseRetreatRef === 'string' && [selectedRetreatCode, selectedRetreatName].includes(expenseRetreatRef);

      if (!matchesId && !matchesCode && !matchesLegacyString) return false;
    }

    return true;
  });

  // Calculate totals
  const totalsByCurrency = filteredExpenses.reduce((acc, expense) => {
    if (!acc[expense.currency]) {
      acc[expense.currency] = 0;
    }
    acc[expense.currency] += expense.amount;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return <LoadingSpinner message="Loading expenses..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Expense Management</h1>
        <p className="text-gray-600">Track retreat and general company expenses</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(totalsByCurrency).map(([currency, total]) => (
          <div key={currency} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total {currency}</p>
                <p className="text-xl font-semibold">{formatCurrency(total, currency)}</p>
              </div>
              <Icon icon={FiDollarSign} className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        ))}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-xl font-semibold">{filteredExpenses.length}</p>
            </div>
            <Icon icon={FiTag} className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filters and Add Button */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Icon icon={FiFilter} className="w-4 h-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'retreat' | 'general')}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Expenses</option>
                <option value="retreat">Retreat Expenses</option>
                <option value="general">General Expenses</option>
              </select>
            </div>

            {filterType !== 'general' && (
              <select
                value={filterRetreatId}
                onChange={(e) => setFilterRetreatId(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Retreats</option>
                {retreats.map(retreat => (
                  <option key={retreat._id} value={retreat._id}>
                    {getRetreatCode(retreat)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <AppleButton
            onClick={() => setShowAddForm(true)}
            variant="primary"
          >
            <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
            Add Expense
          </AppleButton>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Type *
              </label>
              <select
                value={typeof formData.expenseTypeId === 'string' ? formData.expenseTypeId : formData.expenseTypeId?._id || ''}
                onChange={(e) => setFormData({...formData, expenseTypeId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select type...</option>
                {expenseTypes.map(type => (
                  <option key={type._id} value={type._id}>
                    {type.name} ({type.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retreat (leave empty for general expense)
              </label>
              <select
                value={getRetreatReferenceId(formData.retreatId as RetreatReference)}
                onChange={(e) => setFormData({...formData, retreatId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">General Company Expense</option>
                {retreats.map(retreat => (
                  <option key={retreat._id} value={retreat._id}>
                    {getRetreatCode(retreat)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value as 'EUR' | 'USD' | 'CZK' | 'PLN'})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="CZK">CZK</option>
                <option value="PLN">PLN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor
              </label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({...formData, expenseDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as 'pending' | 'approved' | 'paid' | 'rejected'})}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <AppleButton
                type="button"
                onClick={resetForm}
                variant="ghost"
              >
                Cancel
              </AppleButton>
              <AppleButton
                type="submit"
                variant="primary"
              >
                {editingExpense ? 'Update' : 'Add'} Expense
              </AppleButton>
            </div>
          </form>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retreat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(expense.expenseDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiTag} className="w-4 h-4 mr-2 text-gray-400" />
                      {getExpenseTypeName(expense.expenseTypeId)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiCalendar} className="w-4 h-4 mr-2 text-gray-400" />
                      {getRetreatName(expense.retreatId)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.vendor || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {expense.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(expense.amount, expense.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(expense.status)}`}>
                      {expense.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                        title="Edit expense"
                      >
                        <Icon icon={FiEdit2} className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense._id!)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                        title="Delete expense"
                      >
                        <Icon icon={FiTrash2} className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No expenses found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;
