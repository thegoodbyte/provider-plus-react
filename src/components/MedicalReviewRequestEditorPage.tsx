import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import SearchableMedicalTrackingSelect from './SearchableMedicalTrackingSelect';
import { clientsApi, medicalReviewRequestsApi, medicalTrackingApi, retreatsApi } from '../services/api';
import { Client, MedicalItem, MedicalReviewRequest, Retreat } from '../types';

type FormState = {
  medicalTrackingId: string;
  clientId: string;
  retreatId: string;
  requestType: MedicalReviewRequest['requestType'];
  status: MedicalReviewRequest['status'];
  requestedBy: string;
  assignedTo: string;
  reviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  reviewNotes: string;
  overallNotes: string;
  ekgReviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  ekgReviewNotes: string;
  liverReviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  liverReviewNotes: string;
};

const MedicalReviewRequestEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trackingItems, setTrackingItems] = useState<MedicalItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [form, setForm] = useState<FormState>({
    medicalTrackingId: '',
    clientId: '',
    retreatId: '',
    requestType: 'both',
    status: 'pending',
    requestedBy: 'Provider Plus CRM',
    assignedTo: '',
    reviewDecision: '',
    reviewNotes: '',
    overallNotes: '',
    ekgReviewDecision: '',
    ekgReviewNotes: '',
    liverReviewDecision: '',
    liverReviewNotes: '',
  });

  const [requestNumber, setRequestNumber] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trackingResponse, clientsResponse, retreatsResponse, nextDisplayResponse] = await Promise.all([
        medicalTrackingApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        medicalReviewRequestsApi.getNextDisplayId(),
      ]);

      setTrackingItems(trackingResponse.data || []);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
      setRequestNumber(nextDisplayResponse.data || null);

      if (isEdit && id) {
        const existing = await medicalReviewRequestsApi.getOne(id);
        const record = existing.data;
        setForm({
          medicalTrackingId: typeof record.medicalTrackingId === 'string' ? record.medicalTrackingId : record.medicalTrackingId?._id || '',
          clientId: typeof record.clientId === 'string' ? record.clientId : record.clientId?._id || '',
          retreatId: typeof record.retreatId === 'string' ? record.retreatId : record.retreatId?._id || '',
          requestType: record.requestType,
          status: record.status,
          requestedBy: record.requestedBy || '',
          assignedTo: record.assignedTo || '',
          reviewDecision: record.reviewDecision || '',
          reviewNotes: record.reviewNotes || '',
          overallNotes: record.overallNotes || '',
          ekgReviewDecision: record.ekgReviewDecision || '',
          ekgReviewNotes: record.ekgReviewNotes || '',
          liverReviewDecision: record.liverReviewDecision || '',
          liverReviewNotes: record.liverReviewNotes || '',
        });
      }
    } catch (error) {
      console.error('Error loading review request editor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTracking = useMemo(
    () => trackingItems.find((item) => item._id === form.medicalTrackingId),
    [trackingItems, form.medicalTrackingId],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client._id === form.clientId),
    [clients, form.clientId],
  );

  const selectedRetreat = useMemo(
    () => retreats.find((retreat) => retreat._id === form.retreatId),
    [retreats, form.retreatId],
  );

  useEffect(() => {
    if (!selectedTracking) return;
    setForm((prev) => ({
      ...prev,
      clientId: selectedTracking.client_id || prev.clientId,
      retreatId: selectedTracking.retreatId || prev.retreatId,
    }));
  }, [selectedTracking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (!form.medicalTrackingId) {
        throw new Error('Select a medical tracking record first');
      }

      if (isEdit && id) {
        await medicalReviewRequestsApi.update(id, {
          clientId: form.clientId,
          retreatId: form.retreatId,
          medicalTrackingId: form.medicalTrackingId,
          requestType: form.requestType,
          status: form.status,
          requestedBy: form.requestedBy,
          assignedTo: form.assignedTo,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          ekgReviewDecision: form.ekgReviewDecision || undefined,
          ekgReviewNotes: form.ekgReviewNotes,
          liverReviewDecision: form.liverReviewDecision || undefined,
          liverReviewNotes: form.liverReviewNotes,
        });
      } else {
        const legacyRequestType = ['ekg', 'liver', 'both'].includes(form.requestType) ? form.requestType as 'ekg' | 'liver' | 'both' : 'both';
        await medicalReviewRequestsApi.createFromTracking(form.medicalTrackingId, legacyRequestType);
      }
      navigate('/admin/medical-review-requests');
    } catch (error) {
      console.error('Error saving medical review request:', error);
      alert('Error saving medical review request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review request..." />;
  }

  return (
    <div className="min-h-[calc(100vh-96px)] bg-white px-3 py-4 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{isEdit ? 'Edit Medical Review Request' : 'Add Medical Review Request'}</h1>
          <p className="text-sm text-gray-600">Create a review round from an existing medical tracking record.</p>
        </div>
        <div className="text-left text-sm text-gray-500 sm:text-right">
          <div>Request # {requestNumber ? requestNumber : '—'}</div>
          {selectedClient && <div>{selectedClient.firstName} {selectedClient.lastName}</div>}
          {selectedRetreat && <div>{selectedRetreat.name}</div>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Medical Tracking Record</label>
            <SearchableMedicalTrackingSelect
              items={trackingItems}
              value={form.medicalTrackingId}
              onChange={(medicalTrackingId) => {
                const tracking = trackingItems.find((item) => item._id === medicalTrackingId);
                setForm((prev) => ({
                  ...prev,
                  medicalTrackingId,
                  clientId: tracking?.client_id || prev.clientId,
                  retreatId: tracking?.retreatId || prev.retreatId,
                  requestType: tracking?.ekgFileName && tracking?.liverPanelFileName ? 'both' : tracking?.ekgFileName ? 'ekg' : tracking?.liverPanelFileName ? 'liver' : prev.requestType,
                }));
              }}
            />
            <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              <div>Client ID: {form.clientId || '—'}</div>
              <div>Retreat ID: {form.retreatId || '—'}</div>
              <div>EKG: {selectedTracking?.ekgFileName || 'No file'}</div>
              <div>Liver: {selectedTracking?.liverPanelFileName || 'No file'}</div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Request Type</label>
            <select
              value={form.requestType}
              onChange={(e) => setForm({ ...form, requestType: e.target.value as FormState['requestType'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="ekg">EKG</option>
              <option value="liver">Liver</option>
              <option value="both">Both</option>
              <option value="ekg_review">Entry EKG Review</option>
              <option value="ceremony_ekg_review">Ceremony EKG Review</option>
              <option value="blood_pressure_review">Blood Pressure Review</option>
              <option value="liver_panel_review">Liver Panel Review</option>
              <option value="medications_review">Medications Review</option>
              <option value="questionnaire_review">Questionnaire Review</option>
              <option value="food_review">Food Intake Review</option>
              <option value="medical_question">Medical Question</option>
              <option value="general_clearance">General Clearance</option>
            </select>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  {(['pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Assigned To</label>
                <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Requested By</label>
            <input value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2" />
            <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">Review Decision</label>
            <select value={form.reviewDecision} onChange={(e) => setForm({ ...form, reviewDecision: e.target.value as FormState['reviewDecision'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              <option value="OK">Accept</option>
              <option value="caution">Caution</option>
              <option value="NOT OK">Deny</option>
            </select>
            <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">Overall Notes</label>
            <textarea value={form.overallNotes} onChange={(e) => setForm({ ...form, overallNotes: e.target.value })} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">EKG Notes</label>
            <select value={form.ekgReviewDecision} onChange={(e) => setForm({ ...form, ekgReviewDecision: e.target.value as FormState['ekgReviewDecision'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              <option value="OK">Accept</option>
              <option value="caution">Caution</option>
              <option value="NOT OK">Deny</option>
            </select>
            <textarea value={form.ekgReviewNotes} onChange={(e) => setForm({ ...form, ekgReviewNotes: e.target.value })} rows={4} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="EKG-specific comment" />

            <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">Liver Notes</label>
            <select value={form.liverReviewDecision} onChange={(e) => setForm({ ...form, liverReviewDecision: e.target.value as FormState['liverReviewDecision'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="">Select</option>
              <option value="OK">Accept</option>
              <option value="caution">Caution</option>
              <option value="NOT OK">Deny</option>
            </select>
            <textarea value={form.liverReviewNotes} onChange={(e) => setForm({ ...form, liverReviewNotes: e.target.value })} rows={4} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Liver-specific comment" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={() => navigate('/admin/medical-review-requests')} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicalReviewRequestEditorPage;
