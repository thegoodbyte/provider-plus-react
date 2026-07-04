import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import SearchableMedicalTrackingSelect from './SearchableMedicalTrackingSelect';
import { clientsApi, medicalArtifactsApi, medicalReviewRequestsApi, medicalTrackingApi, retreatsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { useAuth } from '../context/AuthContext';
import { Client, MedicalArtifact, MedicalItem, MedicalReviewRequest, Retreat } from '../types';

type FormState = {
  medicalTrackingId: string;
  clientId: string;
  retreatId: string;
  artifactIds: string[];
  documentStage: NonNullable<MedicalArtifact['documentStage']> | '';
  documentType: NonNullable<MedicalArtifact['documentType']> | '';
  ceremonyNumber: number | '';
  requestType: NonNullable<MedicalReviewRequest['requestType']>;
  status: MedicalReviewRequest['status'];
  requestedBy: string;
  assignedTo: string;
  assignedToUserId: string;
  reviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  reviewNotes: string;
  overallNotes: string;
  medicalStaffNotes: string;
};

const reviewTypeByArtifact = (artifactType: MedicalArtifact['artifactType']): NonNullable<MedicalReviewRequest['requestType']> => {
  if (artifactType === 'ekg') return 'ekg_review';
  if (artifactType === 'ceremony_ekg') return 'ceremony_ekg_review';
  if (artifactType === 'blood_pressure') return 'blood_pressure_review';
  if (artifactType === 'liver_panel') return 'liver_panel_review';
  if (artifactType === 'medications_form' || artifactType === 'medication_list') return 'medications_review';
  if (artifactType === 'questionnaire') return 'questionnaire_review';
  if (artifactType === 'food_intake') return 'food_review';
  if (artifactType === 'question') return 'medical_question';
  return 'general_clearance';
};

const formatArtifactType = (artifactType?: MedicalArtifact['artifactType']) =>
  artifactType ? artifactType.replace(/_/g, ' ') : 'medical artifact';

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

const getArtifactDocumentMeta = (artifact?: MedicalArtifact | null) => ({
  documentStage: (artifact?.documentStage || '') as FormState['documentStage'],
  documentType: (artifact?.documentType || '') as FormState['documentType'],
  ceremonyNumber: (artifact?.ceremonyNumber || '') as FormState['ceremonyNumber'],
});

const formatDocumentMeta = (stage?: MedicalArtifact['documentStage'] | '', type?: MedicalArtifact['documentType'] | '', ceremonyNumber?: number | '') => {
  const parts = [
    stage ? documentStageLabels[stage] : '',
    type ? documentTypeLabels[type] : '',
    ceremonyNumber ? `Ceremony #${ceremonyNumber}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No document stage/type recorded';
};

const getArtifactFileUrl = (file: NonNullable<MedicalArtifact['files']>[number]) => {
  const storedPath = file.url || file.filePath || file.s3Key || '';
  return /^https?:\/\//i.test(storedPath) ? storedPath : '';
};

const getRecordId = (value: string | { _id?: string } | undefined | null) => {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id || '';
};

const MedicalReviewRequestEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const artifactId = new URLSearchParams(location.search).get('artifactId') || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trackingItems, setTrackingItems] = useState<MedicalItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [medicalUsers, setMedicalUsers] = useState<User[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<MedicalArtifact | null>(null);
  const [clientArtifacts, setClientArtifacts] = useState<MedicalArtifact[]>([]);
  const [isArtifactModalOpen, setIsArtifactModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    medicalTrackingId: '',
    clientId: '',
    retreatId: '',
    artifactIds: [],
    documentStage: '',
    documentType: '',
    ceremonyNumber: '',
    requestType: 'both',
    status: 'pending',
    requestedBy: 'Provider Plus CRM',
    assignedTo: '',
    assignedToUserId: '',
    reviewDecision: '',
    reviewNotes: '',
    overallNotes: '',
    medicalStaffNotes: '',
  });

  const [requestNumber, setRequestNumber] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [id, artifactId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trackingResponse, clientsResponse, retreatsResponse, nextDisplayResponse, usersResponse, artifactResponse] = await Promise.all([
        medicalTrackingApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        medicalReviewRequestsApi.getNextDisplayId(),
        usersApi.getAll().catch(() => ({ data: [] as User[] })),
        artifactId ? medicalArtifactsApi.getOne(artifactId).catch(() => null) : Promise.resolve(null),
      ]);

      setTrackingItems(trackingResponse.data || []);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
      setMedicalUsers((usersResponse.data || []).filter((item) => item.role === 'medical_advisor' && item.isActive !== false));
      setRequestNumber(nextDisplayResponse.data || null);
      if (artifactResponse?.data) {
        const artifact = artifactResponse.data;
        setSelectedArtifact(artifact);
        setForm((prev) => ({
          ...prev,
          clientId: typeof artifact.clientId === 'string' ? artifact.clientId : artifact.clientId?._id || prev.clientId,
          retreatId: typeof artifact.retreatId === 'string' ? artifact.retreatId : artifact.retreatId?._id || prev.retreatId,
          artifactIds: artifact._id ? Array.from(new Set([...prev.artifactIds, artifact._id])) : prev.artifactIds,
          ...getArtifactDocumentMeta(artifact),
          requestType: reviewTypeByArtifact(artifact.artifactType),
        }));
      }

      if (isEdit && id) {
        const existing = await medicalReviewRequestsApi.getOne(id);
        const record = existing.data;
        setForm({
          medicalTrackingId: typeof record.medicalTrackingId === 'string' ? record.medicalTrackingId : record.medicalTrackingId?._id || '',
          clientId: typeof record.clientId === 'string' ? record.clientId : record.clientId?._id || '',
          retreatId: typeof record.retreatId === 'string' ? record.retreatId : record.retreatId?._id || '',
          artifactIds: (record.artifactIds || []).map((artifact: string | MedicalArtifact) => getRecordId(artifact)).filter(Boolean),
          documentStage: record.documentStage || record.artifactSnapshot?.documentStage as FormState['documentStage'] || '',
          documentType: record.documentType || record.artifactSnapshot?.documentType as FormState['documentType'] || '',
          ceremonyNumber: (record.ceremonyNumber || record.artifactSnapshot?.ceremonyNumber || '') as FormState['ceremonyNumber'],
          requestType: record.requestType,
          status: record.status,
          requestedBy: record.requestedBy || '',
          assignedTo: record.assignedTo || '',
          assignedToUserId: typeof record.assignedToUserId === 'string' ? record.assignedToUserId : record.assignedToUserId?._id || '',
          reviewDecision: record.reviewDecision || '',
          reviewNotes: record.reviewNotes || '',
          overallNotes: record.overallNotes || '',
          medicalStaffNotes: record.medicalStaffNotes || '',
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

  useEffect(() => {
    const loadClientArtifacts = async () => {
      if (!form.clientId) {
        setClientArtifacts([]);
        return;
      }

      try {
        const response = await medicalArtifactsApi.getAll({ clientId: form.clientId });
        setClientArtifacts(response.data || []);
      } catch (error) {
        console.error('Error loading client medical artifacts:', error);
        setClientArtifacts([]);
      }
    };

    loadClientArtifacts();
  }, [form.clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (!form.medicalTrackingId && !selectedArtifact?._id && form.artifactIds.length === 0) {
        throw new Error('Select a medical tracking record or linked medical artifact first');
      }
      if (!form.assignedToUserId) {
        throw new Error('Select a medical advisor before creating the review request.');
      }

      if (isEdit && id) {
        await medicalReviewRequestsApi.update(id, {
          clientId: form.clientId,
          retreatId: form.retreatId,
          medicalTrackingId: form.medicalTrackingId,
          artifactIds: form.artifactIds,
          documentStage: form.documentStage || undefined,
          documentType: form.documentType || undefined,
          ceremonyNumber: form.ceremonyNumber || undefined,
          requestType: form.requestType,
          status: form.status,
          requestedBy: form.requestedBy,
          assignedTo: form.assignedTo,
          assignedToUserId: form.assignedToUserId,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          medicalStaffNotes: form.medicalStaffNotes,
        });
      } else {
        const payload = {
          clientId: form.clientId,
          retreatId: form.retreatId || undefined,
          artifactIds: form.artifactIds,
          documentStage: form.documentStage || undefined,
          documentType: form.documentType || undefined,
          ceremonyNumber: form.ceremonyNumber || undefined,
          requestType: form.requestType,
          status: form.status,
          assignedTo: form.assignedTo,
          assignedToUserId: form.assignedToUserId,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          medicalStaffNotes: form.medicalStaffNotes,
        };
        if (selectedArtifact?._id) {
          await medicalReviewRequestsApi.createFromArtifact(selectedArtifact._id, form.requestType, payload);
        } else if (form.artifactIds.length > 0) {
          await medicalReviewRequestsApi.create(payload as any);
        } else {
          await medicalReviewRequestsApi.create({ ...payload, medicalTrackingId: form.medicalTrackingId } as any);
        }
      }
      navigate('/admin/medical-review-requests');
    } catch (error) {
      console.error('Error saving medical review request:', error);
      alert(error instanceof Error ? error.message : 'Error saving medical review request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review request..." />;
  }

  const selectedArtifacts = clientArtifacts.filter((artifact) => artifact._id && form.artifactIds.includes(artifact._id));

  return (
    <div className="min-h-[calc(100vh-96px)] bg-white px-3 py-4 sm:px-6">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{isEdit ? 'Edit Medical Review Request' : 'Add Medical Review Request'}</h1>
          <p className="text-sm text-gray-600">Create a review round from a stored medical record or existing tracking item.</p>
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
            <label className="mb-2 block text-sm font-medium text-gray-700">Medical Record</label>
            {selectedArtifact ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <div className="font-semibold text-blue-950">#{selectedArtifact.display_id || '—'} {selectedArtifact.title}</div>
                <div className="mt-1 capitalize text-blue-800">{formatArtifactType(selectedArtifact.artifactType)}</div>
                <div className="mt-1 text-xs font-medium text-blue-700">
                  {formatDocumentMeta(selectedArtifact.documentStage, selectedArtifact.documentType, selectedArtifact.ceremonyNumber)}
                </div>
              </div>
            ) : (
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
            )}
            <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              <div>Client ID: {form.clientId || '—'}</div>
              <div>Retreat ID: {form.retreatId || '—'}</div>
              <div>Document stage: {form.documentStage ? documentStageLabels[form.documentStage] : '—'}</div>
              <div>Document type: {form.documentType ? documentTypeLabels[form.documentType] : '—'}</div>
              {form.ceremonyNumber ? <div>Ceremony #: {form.ceremonyNumber}</div> : null}
              {!selectedArtifact && (
                <>
                  <div>EKG: {selectedTracking?.ekgFileName || 'No file'}</div>
                  <div>Liver: {selectedTracking?.liverPanelFileName || 'No file'}</div>
                </>
              )}
              <div className="sm:col-span-2">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-gray-700">Linked files</div>
                  <button
                    type="button"
                    onClick={() => setIsArtifactModalOpen(true)}
                    disabled={!form.clientId}
                    className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Add More Files
                  </button>
                </div>
                {selectedArtifacts.length ? (
                  <div className="space-y-2">
                    {selectedArtifacts.map((artifact) => (
                      <div key={artifact._id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {artifact.title || 'Medical artifact'}</div>
                        <div className="mt-1 text-xs capitalize text-gray-500">{artifact.artifactType?.replace(/_/g, ' ')} · {formatDocumentMeta(artifact.documentStage, artifact.documentType, artifact.ceremonyNumber)} · {artifact.files?.length || 0} file(s)</div>
                        {artifact.files?.length ? (
                          <div className="mt-2 space-y-2">
                            {artifact.files.map((file, index) => {
                              const fileUrl = getArtifactFileUrl(file);
                              return (
                                <div key={`${file.fileName || file.s3Key || index}`} className="rounded-md border border-gray-200 bg-white p-2">
                                  <div className="font-medium text-gray-900">{file.fileName || `File ${index + 1}`}</div>
                                  <div className="mt-1 break-all text-xs text-gray-500">{file.s3Key || file.filePath || 'No storage path recorded'}</div>
                                  {fileUrl && (
                                    <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                                      Open file
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">No files are attached to this medical artifact.</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-gray-500">No stored files linked yet.</div>
                )}
              </div>
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
                <label className="mb-2 block text-sm font-medium text-gray-700">Medical Advisor <span className="text-red-600">*</span></label>
                <select
                  value={form.assignedToUserId}
                  required
                  onChange={(e) => {
                    const assigned = medicalUsers.find((item) => item._id === e.target.value);
                    setForm({
                      ...form,
                      assignedToUserId: e.target.value,
                      assignedTo: assigned ? [assigned.firstName, assigned.lastName].filter(Boolean).join(' ') || assigned.email : '',
                    });
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select medical advisor</option>
                  {medicalUsers.map((medicalUser) => (
                    <option key={medicalUser._id} value={medicalUser._id}>
                      {[medicalUser.firstName, medicalUser.lastName].filter(Boolean).join(' ') || medicalUser.email} ({medicalUser.email})
                    </option>
                  ))}
                </select>
                {medicalUsers.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">No active medical advisors are available.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Requested By</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || form.requestedBy}
            </div>
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
            <label className="mb-2 block text-sm font-medium text-gray-700">Medical Staff Notes</label>
            <textarea
              value={form.medicalStaffNotes}
              onChange={(e) => setForm({ ...form, medicalStaffNotes: e.target.value })}
              rows={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Instructions, context, or questions for the medical advisor"
            />
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

      {isArtifactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Link Client Files</h2>
                <p className="text-sm text-gray-500">Select the stored medical artifacts that should be reviewed with this request.</p>
              </div>
              <button type="button" onClick={() => setIsArtifactModalOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Done
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-5">
              {!form.clientId ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">Select a client first.</div>
              ) : clientArtifacts.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">No medical artifacts found for this client.</div>
              ) : (
                <div className="space-y-3">
                  {clientArtifacts.map((artifact) => {
                    const artifactRecordId = artifact._id || '';
                    const checked = artifactRecordId ? form.artifactIds.includes(artifactRecordId) : false;
                    return (
                      <label key={artifactRecordId || artifact.display_id} className="flex cursor-pointer gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!artifactRecordId}
                          onChange={(event) => {
                            const nextArtifactIds = event.target.checked
                              ? Array.from(new Set([...form.artifactIds, artifactRecordId]))
                              : form.artifactIds.filter((item) => item !== artifactRecordId);
                            const primaryArtifact = event.target.checked
                              ? artifact
                              : clientArtifacts.find((candidate) => candidate._id && nextArtifactIds.includes(candidate._id));
                            setForm((prev) => ({
                              ...prev,
                              artifactIds: nextArtifactIds,
                              ...getArtifactDocumentMeta(primaryArtifact),
                            }));
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {artifact.title || 'Medical artifact'}</div>
                          <div className="mt-1 text-xs capitalize text-gray-500">{artifact.artifactType?.replace(/_/g, ' ')} · {formatDocumentMeta(artifact.documentStage, artifact.documentType, artifact.ceremonyNumber)} · {artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleString() : 'No received date'}</div>
                          {artifact.files?.length ? (
                            <div className="mt-2 space-y-1">
                              {artifact.files.map((file, index) => (
                                <div key={`${file.fileName || file.s3Key || index}`} className="break-all rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                                  {file.fileName || file.s3Key || file.filePath || `File ${index + 1}`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-gray-500">No files attached.</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalReviewRequestEditorPage;
