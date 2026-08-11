import React, { FormEvent, useEffect, useState } from 'react';
import { Check, Pencil, Power, Trash2, X } from 'lucide-react';
import { expenseTypesApi } from '../services/api';
import { ExpenseType } from '../types';

const categories: ExpenseType['category'][] = ['accommodation', 'transport', 'food', 'activities', 'staff', 'utilities', 'general'];
const emptyForm = { name: '', description: '', category: 'general' as ExpenseType['category'], defaultCurrency: 'CZK', defaultAmount: 0, isActive: true };

const ExpenseTypesSettings: React.FC = () => {
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [editing, setEditing] = useState<ExpenseType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const response = await expenseTypesApi.getAll();
      setTypes(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Could not load expense types.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const reset = () => { setEditing(null); setForm(emptyForm); };
  const edit = (type: ExpenseType) => {
    setEditing(type);
    setForm({ name: type.name, description: type.description || '', category: type.category || 'general', defaultCurrency: type.defaultCurrency || 'CZK', defaultAmount: Number(type.defaultAmount || 0), isActive: type.isActive !== false });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form, name: form.name.trim(), description: form.description.trim(), defaultAmount: Number(form.defaultAmount || 0) };
      if (editing?._id) await expenseTypesApi.update(editing._id, payload);
      else await expenseTypesApi.create(payload as Omit<ExpenseType, '_id'>);
      reset(); await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Could not save the expense type.');
    } finally { setSaving(false); }
  };
  const toggle = async (type: ExpenseType) => {
    if (!type._id) return;
    try { type.isActive === false ? await expenseTypesApi.activate(type._id) : await expenseTypesApi.deactivate(type._id); await load(); }
    catch (toggleError: any) { setError(toggleError?.response?.data?.message || 'Could not update the expense type.'); }
  };
  const remove = async (type: ExpenseType) => {
    if (!type._id || !window.confirm(`Delete expense type “${type.name}”?`)) return;
    try { await expenseTypesApi.delete(type._id); if (editing?._id === type._id) reset(); await load(); }
    catch (deleteError: any) { setError(deleteError?.response?.data?.message || 'This expense type cannot be deleted because it is in use. Deactivate it instead.'); }
  };

  return <div className="payment-types-settings">
    <h3>Expense types</h3>
    <p>Global categories available when adding planned or actual expenses. Existing IDs are preserved when a type is edited or deactivated.</p>
    {error && <div className="error-message">{Array.isArray(error) ? error.join(' ') : error}</div>}
    <form onSubmit={submit} className="new-payment-type">
      <h4>{editing ? `Edit ${editing.name}` : 'Add expense type'}</h4>
      <input required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ExpenseType['category'] })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <input type="number" min="0" step="0.01" placeholder="Default amount" value={form.defaultAmount} onChange={(event) => setForm({ ...form, defaultAmount: Number(event.target.value) })} />
      <select value={form.defaultCurrency} onChange={(event) => setForm({ ...form, defaultCurrency: event.target.value })}>{['CZK', 'EUR', 'PLN', 'USD'].map((currency) => <option key={currency}>{currency}</option>)}</select>
      <input placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <label><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
      <button disabled={saving || !form.name.trim()} type="submit">{saving ? 'Saving…' : editing ? 'Save changes' : 'Add type'}</button>
      {editing && <button type="button" onClick={reset}><X size={16} /> Cancel</button>}
    </form>
    <div className="payment-type-list">
      {loading ? <p>Loading expense types…</p> : types.map((type) => <div className="payment-type-row" key={type._id || type.name}>
        <div><strong>{type.name}</strong><small>{type.category} · {type.defaultCurrency || 'CZK'}{type.defaultAmount ? ` ${type.defaultAmount}` : ''}</small></div>
        <span>{type.isActive === false ? 'Inactive' : 'Active'}</span>
        <button type="button" onClick={() => edit(type)} aria-label={`Edit ${type.name}`}><Pencil size={16} /></button>
        <button type="button" onClick={() => void toggle(type)} aria-label={`${type.isActive === false ? 'Activate' : 'Deactivate'} ${type.name}`}>{type.isActive === false ? <Check size={16} /> : <Power size={16} />}</button>
        <button type="button" onClick={() => void remove(type)} aria-label={`Delete ${type.name}`}><Trash2 size={16} /></button>
      </div>)}
    </div>
  </div>;
};

export default ExpenseTypesSettings;
