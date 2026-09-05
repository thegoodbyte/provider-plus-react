import React, { useEffect, useState } from 'react';
import { paymentRequestTypesApi, PaymentRequestTypeSetting } from '../services/api';
import './CurrencySettings.css';

const emptyNewType = { key: '', label: '' };

const PaymentRequestTypesSettings: React.FC = () => {
  const [types, setTypes] = useState<PaymentRequestTypeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newType, setNewType] = useState(emptyNewType);

  const load = async () => {
    try {
      setError('');
      const response = await paymentRequestTypesApi.getAll();
      setTypes(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Could not load payment request types.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const saveType = async (item: PaymentRequestTypeSetting) => {
    try {
      setSaving(true); setError('');
      await paymentRequestTypesApi.update(item.key, { label: item.label, active: item.active, sortOrder: item.sortOrder });
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Could not save the payment request type.');
    } finally { setSaving(false); }
  };

  const addType = async () => {
    try {
      setSaving(true); setError('');
      await paymentRequestTypesApi.create({ ...newType, sortOrder: types.length * 10 + 100 });
      setNewType(emptyNewType);
      await load();
    } catch (addError: any) {
      setError(addError?.response?.data?.message || 'Could not create the payment request type.');
    } finally { setSaving(false); }
  };

  return <div className="payment-types-settings">
    <h3>Payment request types</h3>
    <p>Controls the "Request Type" choices when creating a payment request (Deposit, Balance, ...). IDs are permanent. Existing types can be renamed, reordered, or deactivated, but never deleted.</p>
    {error && <div className="error-message">{error}</div>}
    {loading ? <p>Loading payment request types…</p> : <div className="payment-type-list">
      {types.map((item, index) => (
        <div className="payment-type-row" key={item.key}>
          <code>{item.key}</code>
          <input aria-label={`Label for ${item.key}`} value={item.label} onChange={(event) => setTypes((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, label: event.target.value } : entry)))} />
          <input aria-label={`Sort order for ${item.key}`} type="number" value={item.sortOrder} onChange={(event) => setTypes((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, sortOrder: Number(event.target.value) } : entry)))} />
          <label><input type="checkbox" checked={item.active} onChange={(event) => setTypes((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, active: event.target.checked } : entry)))} /> Active</label>
          <button disabled={saving} onClick={() => void saveType(item)}>Save</button>
        </div>
      ))}
    </div>}
    <div className="new-payment-type">
      <h4>Add payment request type</h4>
      <input placeholder="immutable_id" value={newType.key} onChange={(event) => setNewType((current) => ({ ...current, key: event.target.value }))} />
      <input placeholder="Display label" value={newType.label} onChange={(event) => setNewType((current) => ({ ...current, label: event.target.value }))} />
      <button disabled={saving || !newType.key || !newType.label} onClick={() => void addType()}>Add</button>
    </div>
  </div>;
};

export default PaymentRequestTypesSettings;
