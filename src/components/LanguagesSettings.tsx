import React, { useEffect, useState } from 'react';
import { languagesApi, LanguageOption } from '../services/api';
import './CurrencySettings.css';

const emptyNewLanguage = { code: '', name: '' };

const LanguagesSettings: React.FC = () => {
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newLanguage, setNewLanguage] = useState(emptyNewLanguage);

  const load = async () => {
    try {
      setError('');
      const response = await languagesApi.getAll();
      setLanguages(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Could not load languages.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const saveLanguage = async (item: LanguageOption) => {
    try {
      setSaving(true); setError('');
      await languagesApi.update(item.code, { name: item.name, active: item.active, sortOrder: item.sortOrder });
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Could not save the language.');
    } finally { setSaving(false); }
  };

  const addLanguage = async () => {
    try {
      setSaving(true); setError('');
      await languagesApi.create({ ...newLanguage, sortOrder: languages.length * 10 + 100 });
      setNewLanguage(emptyNewLanguage);
      await load();
    } catch (addError: any) {
      setError(addError?.response?.data?.message || 'Could not create the language.');
    } finally { setSaving(false); }
  };

  return <div className="payment-types-settings">
    <h3>Languages</h3>
    <p>Manage language choices for client records and referral notifications. Codes are permanent; disable a language instead of deleting it. Existing records keep their language. Adding a language does not create translations: document and email content still depends on available templates. "Other" remains a client fallback.</p>
    {error && <div className="error-message">{error}</div>}
    {loading ? <p>Loading languages…</p> : <div className="payment-type-list">
      {languages.map((item, index) => (
        <div className="payment-type-row" key={item.code}>
          <code>{item.code}</code>
          <input aria-label={`Name for ${item.code}`} value={item.name} onChange={(event) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, name: event.target.value } : entry)))} />
          <input aria-label={`Sort order for ${item.code}`} type="number" value={item.sortOrder} onChange={(event) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, sortOrder: Number(event.target.value) } : entry)))} />
          <label><input type="checkbox" checked={item.active} onChange={(event) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, active: event.target.checked } : entry)))} /> Active</label>
          <button disabled={saving} onClick={() => void saveLanguage(item)}>Save</button>
        </div>
      ))}
    </div>}
    <div className="new-payment-type">
      <h4>Add language</h4>
      <input placeholder="code (e.g. de)" value={newLanguage.code} onChange={(event) => setNewLanguage((current) => ({ ...current, code: event.target.value }))} />
      <input placeholder="Display name (e.g. German)" value={newLanguage.name} onChange={(event) => setNewLanguage((current) => ({ ...current, name: event.target.value }))} />
      <button disabled={saving || !newLanguage.code || !newLanguage.name} onClick={() => void addLanguage()}>Add</button>
    </div>
  </div>;
};

export default LanguagesSettings;
