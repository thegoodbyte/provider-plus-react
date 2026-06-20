import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Search } from 'lucide-react';
import { clientsApi, medicalArtifactsApi } from '../services/api';
import { Client, MedicalArtifact } from '../types';
import LoadingSpinner from './LoadingSpinner';

type ArtifactType = NonNullable<MedicalArtifact['artifactType']>;

const artifactTypeLabels: Record<ArtifactType, string> = {
  ekg: 'EKG',
  ceremony_ekg: 'Ceremony EKG',
  blood_pressure: 'Blood Pressure',
  liver_panel: 'Liver Panel',
  medications_form: 'Medications Form',
  medication_list: 'Medication List',
  questionnaire: 'Questionnaire',
  food_intake: 'Food Intake',
  contract: 'Contract',
  question: 'Question',
  other: 'Other',
};

const contextTypeLabels: Record<NonNullable<MedicalArtifact['contextType']>, string> = {
  client: 'Client profile',
  booking: 'Booking',
  ceremony: 'Ceremony',
};

const purposeLabels: Record<NonNullable<MedicalArtifact['purpose']>, string> = {
  paid_review: 'Paid review',
  booking_requirement: 'Booking requirement',
  pre_ceremony: 'Pre-ceremony',
  repeat_test: 'Repeat test',
  correction: 'Correction',
  general: 'General',
};

const documentStageLabels: Record<NonNullable<MedicalArtifact['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalArtifact['documentType']>, string> = {
  BP: 'Blood Pressure',
  EKG: 'EKG',
  Liver: 'Liver Panel',
  other: 'Other',
};

const MedicalArtifactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTarget, setUploadTarget] = useState<{ storage: string; bucket: string | null; keyPattern: string; note: string; requiredEnvironment?: string[] } | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    artifactType: 'ekg' as ArtifactType,
    contextType: 'client' as NonNullable<MedicalArtifact['contextType']>,
    purpose: 'paid_review' as NonNullable<MedicalArtifact['purpose']>,
    documentStage: 'entry' as NonNullable<MedicalArtifact['documentStage']>,
    documentType: 'other' as NonNullable<MedicalArtifact['documentType']>,
    ceremonyNumber: undefined as number | undefined,
    title: '',
    resultText: '',
    reviewFeeAmount: '25',
    reviewFeeCurrency: 'EUR' as NonNullable<MedicalArtifact['reviewFeeCurrency']>,
    reviewFeePaid: false,
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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const email = client.email?.toLowerCase() || '';
      return fullName.includes(search) || email.includes(search);
    });
  }, [clients, clientSearch]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c._id === form.clientId);
  }, [clients, form.clientId]);

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
    setError(null);
    try {
      const title = form.title.trim() || selectedFiles[0]?.name || artifactTypeLabels[form.artifactType];
      const resultText = form.resultText.trim();
      const reviewFeeAmount = Number(form.reviewFeeAmount);
      const created = await medicalArtifactsApi.create({
        clientId: form.clientId,
        artifactType: form.artifactType,
        contextType: form.contextType,
        documentStage: form.documentStage,
        documentType: form.documentType,
        ceremonyNumber: form.ceremonyNumber,
        purpose: form.purpose,
        title,
        source: 'manual',
        status: 'stored',
        textContent: resultText || undefined,
        notes: resultText || undefined,
        reviewFeeAmount: Number.isFinite(reviewFeeAmount) ? reviewFeeAmount : undefined,
        reviewFeeCurrency: form.reviewFeeCurrency,
        reviewFeePaid: form.reviewFeePaid,
        tags: [form.purpose, form.contextType].filter(Boolean),
        data: resultText ? {
          resultText,
          resultRecordedAt: new Date().toISOString(),
          resultSource: 'manual',
        } : undefined,
      });

      if (created.data._id && selectedFiles.length > 0) {
        await medicalArtifactsApi.uploadFiles(created.data._id, selectedFiles);
      }

      navigate(`${routePrefix}/medical-artifacts`);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Unable to save this medical record.');
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
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={showClientDropdown ? clientSearch : (selectedClient ? `#${selectedClient.display_id || '-'} ${selectedClient.firstName || selectedClient.fname} ${selectedClient.lastName || selectedClient.lname}` : '')}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => {
                  setShowClientDropdown(true);
                  setClientSearch('');
                }}
                placeholder="Search client by name or email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-8 text-sm"
              />
              <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            {showClientDropdown && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg">
                {filteredClients.length > 0 ? (
                  filteredClients.slice(0, 20).map((client) => {
                    const clientId = client._id;
                    if (!clientId) return null;

                    return (
                      <button
                        key={clientId}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, clientId });
                          setShowClientDropdown(false);
                          setClientSearch('');
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        <div className="font-medium">
                          #{client.display_id || '-'} {client.firstName || client.fname} {client.lastName || client.lname}
                        </div>
                        {client.email && <div className="text-xs text-gray-500">{client.email}</div>}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No clients found</div>
                )}
              </div>
            )}
          </div>
          <select value={form.artifactType} onChange={(event) => setForm({ ...form, artifactType: event.target.value as ArtifactType })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {Object.entries(artifactTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Title or short description" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={form.documentStage}
            onChange={(event) => setForm({ ...form, documentStage: event.target.value as typeof form.documentStage })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(documentStageLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={form.documentType}
            onChange={(event) => setForm({ ...form, documentType: event.target.value as typeof form.documentType })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(documentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {(form.documentStage === 'pre_ceremony' || form.documentStage === 'in_ceremony' || form.documentStage === 'post_ceremony') && (
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="number"
              min="1"
              value={form.ceremonyNumber || ''}
              onChange={(event) => setForm({ ...form, ceremonyNumber: event.target.value ? parseInt(event.target.value) : undefined })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ceremony number (e.g., 1, 2, 3)"
              required
            />
            <div className="col-span-2 flex items-center text-sm text-gray-600">
              <span>Ceremony number is required for {documentStageLabels[form.documentStage]} stage</span>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <select value={form.contextType} onChange={(event) => setForm({ ...form, contextType: event.target.value as typeof form.contextType })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {Object.entries(contextTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as typeof form.purpose })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {Object.entries(purposeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.reviewFeeAmount}
            onChange={(event) => setForm({ ...form, reviewFeeAmount: event.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Review fee"
          />
          <div className="flex items-center gap-2">
            <select value={form.reviewFeeCurrency} onChange={(event) => setForm({ ...form, reviewFeeCurrency: event.target.value as typeof form.reviewFeeCurrency })} className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CZK">CZK</option>
              <option value="PLN">PLN</option>
            </select>
            <label className="flex shrink-0 items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={form.reviewFeePaid}
                onChange={(event) => setForm({ ...form, reviewFeePaid: event.target.checked })}
              />
              Paid
            </label>
          </div>
        </div>

        <textarea
          value={form.resultText}
          onChange={(event) => setForm({ ...form, resultText: event.target.value })}
          className="min-h-[100px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Results, interpretation, repeat/correction notes, or internal medical notes"
        />

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
            {uploadTarget?.requiredEnvironment?.length ? (
              <div className="mt-1"><span className="font-semibold">Required API env:</span> {uploadTarget.requiredEnvironment.join(', ')}</div>
            ) : null}
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
