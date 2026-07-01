import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocumentType } from '../types';
import './BookingDocumentTypesPage.css';

type DraftType = BookingDocumentType & { isNew?: boolean };

const emptyDraft = (): DraftType => ({
  key: '',
  label: '',
  description: '',
  active: true,
  order: 0,
  bookingFlowReceivedStepKey: '',
  bookingFlowSentStepKey: '',
  reviewRequired: false,
  reviewRequestType: undefined,
  isNew: true,
});

const BookingDocumentTypesPage: React.FC = () => {
  const [types, setTypes] = useState<DraftType[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingDocumentsApi.getTypes(true);
      setTypes(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking document types.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const updateDraft = (index: number, patch: Partial<DraftType>) => {
    setTypes((current) => current.map((type, itemIndex) => itemIndex === index ? { ...type, ...patch } : type));
  };

  const saveType = async (index: number) => {
    const draft = types[index];
    if (!draft?.key || !draft.label) {
      setError('Key and label are required.');
      return;
    }
    setSavingId(draft._id || `new-${index}`);
    setError(null);
    setMessage(null);
    const payload = {
      key: draft.key,
      label: draft.label,
      description: draft.description,
      active: draft.active !== false,
      order: Number(draft.order || 0),
      bookingFlowReceivedStepKey: draft.bookingFlowReceivedStepKey || undefined,
      bookingFlowSentStepKey: draft.bookingFlowSentStepKey || undefined,
      reviewRequired: Boolean(draft.reviewRequired),
      reviewRequestType: draft.reviewRequestType || undefined,
    };
    try {
      if (draft._id && !draft.isNew) {
        await bookingDocumentsApi.updateType(draft._id, payload);
      } else {
        await bookingDocumentsApi.createType(payload);
      }
      setMessage('Booking document type saved.');
      await loadTypes();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Unable to save booking document type.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteType = async (index: number) => {
    const draft = types[index];
    if (!draft._id || draft.isNew) {
      setTypes((current) => current.filter((_, itemIndex) => itemIndex !== index));
      return;
    }
    if (!window.confirm(`Delete booking document type "${draft.label}"?`)) return;
    setSavingId(draft._id);
    setError(null);
    setMessage(null);
    try {
      await bookingDocumentsApi.deleteType(draft._id);
      setMessage('Booking document type deleted.');
      await loadTypes();
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Unable to delete booking document type.');
    } finally {
      setSavingId(null);
    }
  };

  const seedDefaults = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await bookingDocumentsApi.seedTypes();
      setMessage(`Seeded booking document types. Created ${response.data.created}, updated ${response.data.updated}.`);
      await loadTypes();
    } catch (seedError: any) {
      setError(seedError?.response?.data?.message || seedError?.message || 'Unable to seed booking document types.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-document-types-page">
      <div className="booking-document-types-header">
        <div>
          <h1>Booking Document Types</h1>
          <p>Configure the document categories shown in Booking → Documents and the booking-step keys they update.</p>
        </div>
        <div className="booking-document-types-actions">
          <button className="btn btn-secondary" type="button" onClick={loadTypes} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-secondary" type="button" onClick={seedDefaults} disabled={loading}>
            Seed defaults
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setTypes((current) => [emptyDraft(), ...current])}>
            <Plus size={16} /> Add type
          </button>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="booking-document-types-list">
        {types.map((type, index) => (
          <div key={type._id || `new-${index}`} className="booking-document-type-row">
            <div className="form-grid">
              <label>
                Key
                <input value={type.key} onChange={(event) => updateDraft(index, { key: event.target.value })} placeholder="contract" />
              </label>
              <label>
                Label
                <input value={type.label} onChange={(event) => updateDraft(index, { label: event.target.value })} placeholder="Contract" />
              </label>
              <label>
                Order
                <input type="number" value={type.order || 0} onChange={(event) => updateDraft(index, { order: Number(event.target.value) })} />
              </label>
              <label>
                Received step key
                <input value={type.bookingFlowReceivedStepKey || ''} onChange={(event) => updateDraft(index, { bookingFlowReceivedStepKey: event.target.value })} placeholder="contract_received" />
              </label>
              <label>
                Sent step key
                <input value={type.bookingFlowSentStepKey || ''} onChange={(event) => updateDraft(index, { bookingFlowSentStepKey: event.target.value })} placeholder="contract_sent" />
              </label>
              <label>
                Review request type
                <input value={type.reviewRequestType || ''} onChange={(event) => updateDraft(index, { reviewRequestType: event.target.value as any })} placeholder="questionnaire_review" />
              </label>
            </div>
            <label className="description-field">
              Description
              <textarea value={type.description || ''} onChange={(event) => updateDraft(index, { description: event.target.value })} rows={2} />
            </label>
            <div className="booking-document-type-footer">
              <label className="checkbox-row">
                <input type="checkbox" checked={type.active !== false} onChange={(event) => updateDraft(index, { active: event.target.checked })} />
                Active
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={Boolean(type.reviewRequired)} onChange={(event) => updateDraft(index, { reviewRequired: event.target.checked })} />
                Review required
              </label>
              <div className="booking-document-types-actions">
                <button className="btn btn-sm btn-primary" type="button" onClick={() => saveType(index)} disabled={Boolean(savingId)}>
                  <Save size={16} /> {savingId === (type._id || `new-${index}`) ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => deleteType(index)} disabled={Boolean(savingId)}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && types.length === 0 && (
          <div className="empty-state">No booking document types configured yet.</div>
        )}
      </div>
    </div>
  );
};

export default BookingDocumentTypesPage;
