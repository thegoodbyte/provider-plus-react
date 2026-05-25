import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import { clientsApi, medicalArtifactsApi } from '../services/api';
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

const MedicalArtifactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTarget, setUploadTarget] = useState<{ storage: string; bucket: string | null; keyPattern: string; note: string } | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    artifactType: 'ekg' as MedicalArtifact['artifactType'],
    title: '',
  });

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await clientsApi.getAll();
        setClients(response.data || []);
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  useEffect(() => {
    const loadUploadTarget = async () => {
      const firstFileName = selectedFiles[0]?.name || `${form.artifactType}.pdf`;
      try {
        const response = await medicalArtifactsApi.getUploadTargetPreview(form.artifactType, firstFileName);
        setUploadTarget(response.data);
      } catch (error) {
        console.error('Error loading upload target preview:', error);
        setUploadTarget(null);
      }
    };
    loadUploadTarget();
  }, [form.artifactType, selectedFiles]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId) return;

    setSaving(true);
    try {
      const title = form.title.trim() || selectedFiles[0]?.name || artifactTypeLabels[form.artifactType];
      const created = await medicalArtifactsApi.create({
        clientId: form.clientId,
        artifactType: form.artifactType,
        title,
        source: 'manual',
        status: 'stored',
      });

      if (created.data._id && selectedFiles.length > 0) {
        await medicalArtifactsApi.uploadFiles(created.data._id, selectedFiles);
      }

      navigate(`${routePrefix}/medical-artifacts`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifact form..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add Medical Record</h1>
          <p className="text-sm text-gray-600">Upload or register one medical artifact for a client.</p>
        </div>
        <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <form onSubmit={handleCreate} className="max-w-4xl space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
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
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Title or short description" />
        </div>

        <div className="rounded-md border border-dashed border-gray-300 bg-white p-3">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Upload className="h-4 w-4" />
            Upload files
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
            onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              {selectedFiles.map((file) => (
                <div key={`${file.name}-${file.size}`}>{file.name} ({Math.round(file.size / 1024)} KB)</div>
              ))}
            </div>
          )}
          <div className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-600">
            <div><span className="font-semibold">Storage:</span> {uploadTarget?.storage || 'checking...'}</div>
            <div><span className="font-semibold">Bucket:</span> {uploadTarget?.bucket || 'not configured / unavailable'}</div>
            <div className="break-all"><span className="font-semibold">Path pattern:</span> {uploadTarget?.keyPattern || 'medical-artifacts/:type/:artifactId/:timestamp_filename'}</div>
            {uploadTarget?.note && <div className="mt-1">{uploadTarget.note}</div>}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving || !form.clientId} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {saving ? 'Saving...' : 'Add Medical Record'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicalArtifactCreatePage;
