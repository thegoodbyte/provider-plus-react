import React, { useEffect, useState } from 'react';
import { languagesApi, LanguageOption } from '../services/api';
import AppleButton from './AppleButton';
import AppleInput from './AppleInput';
import { Card } from './ui';

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

  return <Card>
    <h3 className="text-lg font-semibold text-apple-gray-900">Languages</h3>
    <p className="mt-2 text-sm text-apple-gray-500">Manage language choices for client records and referral notifications. Codes are permanent; disable a language instead of deleting it. Existing records keep their language. Adding a language does not create translations: document and email content still depends on available templates. "Other" remains a client fallback.</p>
    {error && <div role="alert" className="mt-3 rounded-apple bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {loading ? <p className="mt-4 text-sm text-apple-gray-500">Loading languages…</p> : <div className="mt-4 space-y-3">
      {languages.map((item, index) => (
        <div className="grid grid-cols-1 items-end gap-3 border-t border-apple-gray-100 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(60px,80px)_minmax(180px,2fr)_90px_90px_auto]" key={item.code}>
          <code className="self-center text-sm font-semibold text-apple-gray-700">{item.code}</code>
          <AppleInput
            ariaLabel={`Name for ${item.code}`}
            value={item.name}
            onChange={(value) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, name: value } : entry)))}
          />
          <AppleInput
            ariaLabel={`Sort order for ${item.code}`}
            type="number"
            value={item.sortOrder}
            onChange={(value) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, sortOrder: Number(value) } : entry)))}
          />
          <label className="flex items-center gap-2 text-sm text-apple-gray-700"><input type="checkbox" checked={item.active} onChange={(event) => setLanguages((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, active: event.target.checked } : entry)))} /> Active</label>
          <AppleButton variant="secondary" size="sm" disabled={saving} onClick={() => void saveLanguage(item)}>Save</AppleButton>
        </div>
      ))}
    </div>}
    <div className="mt-5 border-t border-apple-gray-200 pt-4">
      <h4 className="text-sm font-semibold text-apple-gray-900">Add language</h4>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <AppleInput fullWidth={false} className="w-32" placeholder="code (e.g. de)" value={newLanguage.code} onChange={(value) => setNewLanguage((current) => ({ ...current, code: value }))} />
        <AppleInput fullWidth={false} className="w-64" placeholder="Display name (e.g. German)" value={newLanguage.name} onChange={(value) => setNewLanguage((current) => ({ ...current, name: value }))} />
        <AppleButton disabled={saving || !newLanguage.code || !newLanguage.name} onClick={() => void addLanguage()}>Add</AppleButton>
      </div>
    </div>
  </Card>;
};

export default LanguagesSettings;
