import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Inbox, Save } from 'lucide-react';
import { medicalArtifactsApi } from '../services/api';
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

type ArtifactStatus = 'stored' | 'superseded' | 'voided';

const getClientLabel = (client?: string | Client) => {
  if (!client || typeof client === 'string') return client || 'Unknown client';
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return [`#${client.display_id || '-'}`, name || client.email || 'Unknown client'].filter(Boolean).join(' ');
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const MedicalArtifactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [artifact, setArtifact] = useState<MedicalArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    notes: '',
    status: 'stored' as ArtifactStatus,
  });

  useEffect(() => {
    const loadArtifact = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await medicalArtifactsApi.getOne(id);
        const item = response.data;
        setArtifact(item);
        setForm({
          title: item.title || '',
          description: item.description || '',
          notes: item.notes || '',
          status: item.status || 'stored',
        });
      } finally {
        setLoading(false);
      }
    };
    loadArtifact();
  }, [id]);

  const storagePaths = useMemo(() => {
    return artifact?.files?.map((file) => file.s3Key || file.filePath).filter(Boolean) || [];
  }, [artifact]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const response = await medicalArtifactsApi.update(id, form);
      setArtifact(response.data);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifact..." />;
  }

  if (!artifact) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">Medical artifact not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Medical Artifact #{artifact.display_id || '-'}</h1>
          <p className="text-sm text-gray-600">{artifactTypeLabels[artifact.artifactType]} for {getClientLabel(artifact.clientId)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`${routePrefix}/medical-review-requests/new?artifactId=${artifact._id}`)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Inbox className="h-4 w-4" />
            Send for Review
          </button>
          <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSave} className="space-y-4 rounded-md border border-gray-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              Title
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ArtifactStatus })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="stored">Stored</option>
                <option value="superseded">Superseded</option>
                <option value="voided">Voided</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Short description of what this artifact contains" />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Admin notes
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={6} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Internal notes about this artifact" />
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Record</h2>
            <dl className="space-y-2">
              <div><dt className="text-gray-500">Client</dt><dd className="font-medium text-gray-900">{getClientLabel(artifact.clientId)}</dd></div>
              <div><dt className="text-gray-500">Type</dt><dd className="font-medium text-gray-900">{artifactTypeLabels[artifact.artifactType]}</dd></div>
              <div><dt className="text-gray-500">Received</dt><dd className="font-medium text-gray-900">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Source</dt><dd className="font-medium capitalize text-gray-900">{artifact.source || 'manual'}</dd></div>
              <div><dt className="text-gray-500">Version</dt><dd className="font-medium text-gray-900">{artifact.version || 1}</dd></div>
            </dl>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Files</h2>
            {artifact.files?.length ? (
              <div className="space-y-3">
                {artifact.files.map((file, index) => (
                  <div key={`${file.fileName || file.s3Key || index}`} className="rounded-md border border-gray-200 p-3">
                    <div className="font-medium text-gray-900">{file.fileName || `File ${index + 1}`}</div>
                    <div className="mt-1 text-xs text-gray-500">{file.mimeType || 'Unknown type'} · {formatBytes(file.size)}</div>
                    <div className="mt-2 break-all rounded bg-gray-50 p-2 text-xs text-gray-600">{file.s3Key || file.filePath || 'No storage path recorded'}</div>
                    {(file.filePath || file.s3Key) && String(file.filePath || file.s3Key).startsWith('http') && (
                      <a href={file.filePath || file.s3Key} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
                        <ExternalLink className="h-3 w-3" />
                        Open file
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-gray-500">No files attached.</div>
            )}
            {storagePaths.length > 0 && (
              <div className="mt-3 text-xs text-gray-500">Storage paths are recorded from the upload response, so the app does not guess bucket paths later.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MedicalArtifactDetailPage;
