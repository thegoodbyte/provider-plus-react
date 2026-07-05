import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Search } from 'lucide-react';
import { bookingsApi, clientsApi, medicalArtifactsApi } from '../services/api';
import { Client, MedicalArtifact, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';

type DocumentStage = NonNullable<MedicalArtifact['documentStage']>;
type DocumentType = NonNullable<MedicalArtifact['documentType']>;

const documentStageLabels: Record<NonNullable<MedicalArtifact['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  other: 'Other',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalArtifact['documentType']>, string> = {
  EKG: 'EKG',
  BP: 'Blood Pressure',
  meds: 'Meds',
  additional: 'Additional',
  Liver: 'Liver panel tests',
  Medications: 'Medications',
  other: 'Other',
};

const ceremonyStages = new Set<DocumentStage>(['pre_ceremony', 'in_ceremony', 'post_ceremony']);

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const getArtifactTypeForDocument = (stage: DocumentStage, type: DocumentType): NonNullable<MedicalArtifact['artifactType']> => {
  if (type === 'EKG') return ceremonyStages.has(stage) ? 'ceremony_ekg' : 'ekg';
  if (type === 'BP') return 'blood_pressure';
  if (type === 'Liver') return 'liver_panel';
  if (type === 'meds' || type === 'Medications') return 'medications_form';
  return 'other';
};

const getPurposeForStage = (stage: DocumentStage): NonNullable<MedicalArtifact['purpose']> => {
  if (stage === 'entry') return 'booking_requirement';
  if (stage === 'pre_ceremony') return 'pre_ceremony';
  if (stage === 'in_ceremony' || stage === 'post_ceremony') return 'repeat_test';
  return 'general';
};

const getBookingLabel = (booking: RetreatClient) => {
  const parts = [
    booking.bookingNumber ? `Booking #${booking.bookingNumber}` : 'Booking',
    booking.status,
    booking.checkInDate ? new Date(booking.checkInDate).toLocaleDateString() : '',
  ].filter(Boolean);
  return parts.join(' - ');
};

const MedicalArtifactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTarget, setUploadTarget] = useState<{ storage: string; bucket: string | null; keyPattern: string; note: string; requiredEnvironment?: string[] } | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [form, setForm] = useState({
    clientId: '',
    documentStage: 'entry' as NonNullable<MedicalArtifact['documentStage']>,
    documentType: 'additional' as NonNullable<MedicalArtifact['documentType']>,
    bookingId: '',
    ceremonyNumber: undefined as number | undefined,
    title: '',
    resultText: '',
    systolic: '',
    diastolic: '',
    heartRate: '',
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
      const fullName = `${client.firstName || client.fname || ''} ${client.lastName || client.lname || ''}`.toLowerCase();
      const email = client.email?.toLowerCase() || '';
      const displayId = String(client.display_id || '');
      return fullName.includes(search) || email.includes(search) || displayId.includes(search);
    });
  }, [clients, clientSearch]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c._id === form.clientId);
  }, [clients, form.clientId]);

  const selectedBooking = useMemo(() => {
    return bookings.find((booking) => booking._id === form.bookingId);
  }, [bookings, form.bookingId]);

  const inferredArtifactType = useMemo(
    () => getArtifactTypeForDocument(form.documentStage, form.documentType),
    [form.documentStage, form.documentType]
  );

  const isCeremonyStage = ceremonyStages.has(form.documentStage);
  const requiresBooking = form.documentStage !== 'entry';
  const isBloodPressure = form.documentType === 'BP';

  useEffect(() => {
    if (!form.clientId) {
      setBookings([]);
      return;
    }

    let isMounted = true;
    setLoadingBookings(true);
    bookingsApi.getByClient(form.clientId)
      .then((response) => {
        if (!isMounted) return;
        setBookings(response.data || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setBookings([]);
      })
      .finally(() => {
        if (isMounted) setLoadingBookings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [form.clientId]);

  useEffect(() => {
    const loadUploadTarget = async () => {
      const firstFileName = selectedFiles[0]?.name || `${inferredArtifactType}.pdf`;
      try {
        const response = await medicalArtifactsApi.getUploadTargetPreview(inferredArtifactType, firstFileName);
        setUploadTarget(response.data);
      } catch (error) {
        console.error('Error loading upload target preview:', error);
        setUploadTarget(null);
      }
    };
    loadUploadTarget();
  }, [inferredArtifactType, selectedFiles]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId) return;
    if (requiresBooking && !form.bookingId) {
      setError('Select a booking. Only entry-level medical records can be saved without a booking.');
      return;
    }
    if (isCeremonyStage && !form.ceremonyNumber) {
      setError('Enter the ceremony number for pre-, in-, or post-ceremony records.');
      return;
    }
    const systolic = Number(form.systolic);
    const diastolic = Number(form.diastolic);
    const heartRate = Number(form.heartRate);
    if (isBloodPressure && (!Number.isFinite(systolic) || !Number.isFinite(diastolic))) {
      setError('Enter systolic and diastolic blood pressure values.');
      return;
    }
    if (isBloodPressure && (systolic < 40 || systolic > 260 || diastolic < 20 || diastolic > 180)) {
      setError('Blood pressure values are outside the expected range.');
      return;
    }
    if (isBloodPressure && form.heartRate && (!Number.isFinite(heartRate) || heartRate < 20 || heartRate > 240)) {
      setError('Heart rate is outside the expected range.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const artifactType = inferredArtifactType;
      const contextType: NonNullable<MedicalArtifact['contextType']> = isCeremonyStage ? 'ceremony' : (form.bookingId ? 'booking' : 'client');
      const purpose = getPurposeForStage(form.documentStage);
      const retreatId = getObjectId(selectedBooking?.retreatId);
      const title = form.title.trim() || selectedFiles[0]?.name || `${documentStageLabels[form.documentStage]} ${documentTypeLabels[form.documentType]}`;
      const resultText = form.resultText.trim();
      const bpText = isBloodPressure
        ? `${systolic}/${diastolic}${form.heartRate ? ` HR ${heartRate}` : ''}`
        : '';
      const textContent = isBloodPressure
        ? [bpText, resultText].filter(Boolean).join('\n')
        : resultText;
      const reviewFeeAmount = Number(form.reviewFeeAmount);
      const created = await medicalArtifactsApi.create({
        clientId: form.clientId,
        retreatId: retreatId || undefined,
        bookingId: form.bookingId || undefined,
        artifactType,
        contextType,
        documentStage: form.documentStage,
        documentType: form.documentType,
        ceremonyNumber: isCeremonyStage ? form.ceremonyNumber : undefined,
        purpose,
        title,
        source: 'manual',
        status: 'stored',
        textContent: textContent || undefined,
        notes: textContent || undefined,
        reviewFeeAmount: Number.isFinite(reviewFeeAmount) ? reviewFeeAmount : undefined,
        reviewFeeCurrency: form.reviewFeeCurrency,
        reviewFeePaid: form.reviewFeePaid,
        tags: [form.documentStage, form.documentType, purpose, contextType].filter(Boolean),
        data: (textContent || isBloodPressure) ? {
          resultText: textContent || undefined,
          systolic: isBloodPressure ? systolic : undefined,
          diastolic: isBloodPressure ? diastolic : undefined,
          heartRate: isBloodPressure && form.heartRate ? heartRate : undefined,
          pulse: isBloodPressure && form.heartRate ? heartRate : undefined,
          resultRecordedAt: new Date().toISOString(),
          resultSource: 'manual',
          bookingId: form.bookingId || undefined,
          ceremonyNumber: isCeremonyStage ? form.ceremonyNumber : undefined,
        } : undefined,
      });

      if (created.data._id && selectedFiles.length > 0) {
        try {
          await medicalArtifactsApi.uploadFiles(created.data._id, selectedFiles);
        } catch (uploadError) {
          await medicalArtifactsApi.delete(created.data._id).catch((rollbackError) => {
            console.error('Error rolling back empty medical artifact:', rollbackError);
          });
          throw uploadError;
        }
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
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Client</label>
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
                          setForm({ ...form, clientId, bookingId: '' });
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
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Booking</label>
            <select
              value={form.bookingId}
              onChange={(event) => setForm({ ...form, bookingId: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={!form.clientId || loadingBookings}
              required={requiresBooking}
            >
              <option value="">{loadingBookings ? 'Loading bookings...' : requiresBooking ? 'Select booking' : 'No booking link'}</option>
              {bookings.map((booking) => (
                <option key={booking._id} value={booking._id}>{getBookingLabel(booking)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Title</label>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Title or short description" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Document stage</label>
            <select
              value={form.documentStage}
              onChange={(event) => {
                const nextStage = event.target.value as DocumentStage;
                setForm({
                  ...form,
                  documentStage: nextStage,
                  ceremonyNumber: ceremonyStages.has(nextStage) ? form.ceremonyNumber : undefined,
                });
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(documentStageLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Document type</label>
            <select
              value={form.documentType}
              onChange={(event) => setForm({ ...form, documentType: event.target.value as typeof form.documentType })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {isBloodPressure && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="mb-3 text-sm font-semibold text-blue-900">Blood pressure values</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Systolic</label>
                <input
                  type="number"
                  min="40"
                  max="260"
                  value={form.systolic}
                  onChange={(event) => setForm({ ...form, systolic: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="120"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Diastolic</label>
                <input
                  type="number"
                  min="20"
                  max="180"
                  value={form.diastolic}
                  onChange={(event) => setForm({ ...form, diastolic: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="80"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Heart rate</label>
                <input
                  type="number"
                  min="20"
                  max="240"
                  value={form.heartRate}
                  onChange={(event) => setForm({ ...form, heartRate: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="72"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-800">You can still upload a BP photo below.</p>
          </div>
        )}

        {isCeremonyStage && (
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Ceremony #</label>
              <input
                type="number"
                min="1"
                value={form.ceremonyNumber || ''}
                onChange={(event) => setForm({ ...form, ceremonyNumber: event.target.value ? parseInt(event.target.value) : undefined })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="1, 2, 3"
                required
              />
            </div>
            <div className="col-span-2 flex items-center text-sm text-gray-600">
              <span>Booking and ceremony number are required for {documentStageLabels[form.documentStage]} records.</span>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
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
