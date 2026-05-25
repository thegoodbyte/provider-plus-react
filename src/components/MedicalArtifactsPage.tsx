import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Inbox, Plus, RefreshCw } from 'lucide-react';
import { clientsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Client, MedicalArtifact } from '../types';
import LoadingSpinner from './LoadingSpinner';

const artifactTypeLabels: Record<MedicalArtifact['artifactType'], string> = {
  ekg: 'EKG',
  ceremony_ekg: 'Ceremony EKG',
  blood_pressure: 'Blood Pressure',
  liver_panel: 'Liver Panel',
  medications_form: 'Medications Form',
  medication_list: 'Medication List',
  questionnaire: 'Questionnaire',
  food_intake: 'Food Intake',
  question: 'Question',
  other: 'Other',
};

const reviewTypeByArtifact: Partial<Record<MedicalArtifact['artifactType'], string>> = {
  ekg: 'ekg_review',
  ceremony_ekg: 'ceremony_ekg_review',
  blood_pressure: 'blood_pressure_review',
  liver_panel: 'liver_panel_review',
  medications_form: 'medications_review',
  medication_list: 'medications_review',
  questionnaire: 'questionnaire_review',
  food_intake: 'food_review',
  question: 'medical_question',
  other: 'general_clearance',
};

const getClientName = (client?: string | Client) => {
  if (!client || typeof client === 'string') return 'Unknown client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
};

const MedicalArtifactsPage: React.FC = () => {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | MedicalArtifact['artifactType']>('all');
  const [form, setForm] = useState({
    clientId: '',
    artifactType: 'ekg' as MedicalArtifact['artifactType'],
    title: '',
    textContent: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [artifactsResponse, clientsResponse] = await Promise.all([
        medicalArtifactsApi.getAll(),
        clientsApi.getAll(),
      ]);
      setArtifacts(artifactsResponse.data || []);
      setClients(clientsResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredArtifacts = useMemo(() => {
    if (typeFilter === 'all') return artifacts;
    return artifacts.filter((artifact) => artifact.artifactType === typeFilter);
  }, [artifacts, typeFilter]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId || !form.title.trim()) return;

    setSaving(true);
    try {
      await medicalArtifactsApi.create({
        clientId: form.clientId,
        artifactType: form.artifactType,
        title: form.title.trim(),
        textContent: form.textContent.trim(),
        notes: form.notes.trim(),
        source: 'manual',
        status: 'stored',
      });
      setForm({ clientId: form.clientId, artifactType: form.artifactType, title: '', textContent: '', notes: '' });
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleRequestReview = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    await medicalReviewRequestsApi.createFromArtifact(artifact._id, reviewTypeByArtifact[artifact.artifactType] as any);
    navigate('/admin/medical-review-requests');
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifacts..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Medical Artifacts</h1>
          <p className="text-sm text-gray-600">Stored EKGs, liver panels, medication forms, questions, and other medical records.</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-5">
        <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-1">
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client._id} value={client._id}>
              #{client.display_id || '-'} {client.firstName || client.fname} {client.lastName || client.lname}
            </option>
          ))}
        </select>
        <select value={form.artifactType} onChange={(event) => setForm({ ...form, artifactType: event.target.value as MedicalArtifact['artifactType'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          {Object.entries(artifactTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Title or short description" />
        <button type="submit" disabled={saving || !form.clientId || !form.title.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          <Plus className="h-4 w-4" />
          Add Artifact
        </button>
        <textarea value={form.textContent} onChange={(event) => setForm({ ...form, textContent: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-3" rows={2} placeholder="Question, note, or text content" />
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" rows={2} placeholder="Internal notes" />
      </form>

      <div className="mb-4 flex items-center gap-2">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All artifact types</option>
          {Object.entries(artifactTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredArtifacts.map((artifact) => (
              <tr key={artifact._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">#{artifact.display_id}</td>
                <td className="px-4 py-3">{artifactTypeLabels[artifact.artifactType]}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{artifact.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{getClientName(artifact.clientId)}</td>
                <td className="px-4 py-3">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3 capitalize">{artifact.status || 'stored'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleRequestReview(artifact)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    <Inbox className="h-3.5 w-3.5" />
                    Request Review
                  </button>
                </td>
              </tr>
            ))}
            {filteredArtifacts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No medical artifacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicalArtifactsPage;
