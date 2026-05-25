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
  requestType: MedicalReviewRequest['requestType'];
  status: MedicalReviewRequest['status'];
  requestedBy: string;
  assignedTo: string;
  assignedToUserId: string;
  reviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  reviewNotes: string;
  overallNotes: string;
  ekgReviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  ekgReviewNotes: string;
  liverReviewDecision: 'OK' | 'caution' | 'NOT OK' | '';
  liverReviewNotes: string;
};

const reviewTypeByArtifact = (artifactType: MedicalArtifact['artifactType']): MedicalReviewRequest['requestType'] => {
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

const getArtifactFileUrl = (file: NonNullable<MedicalArtifact['files']>[number]) => {
  const storedPath = file.url || file.filePath || file.s3Key || '';
  return /^https?:\/\//i.test(storedPath) ? storedPath : '';
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
  const [form, setForm] = useState<FormState>({
    medicalTrackingId: '',
    clientId: '',
    retreatId: '',
    requestType: 'both',
    status: 'pending',
    requestedBy: 'Provider Plus CRM',
    assignedTo: '',
    assignedToUserId: '',
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
          requestType: record.requestType,
          status: record.status,
          requestedBy: record.requestedBy || '',
          assignedTo: record.assignedTo || '',
          assignedToUserId: typeof record.assignedToUserId === 'string' ? record.assignedToUserId : record.assignedToUserId?._id || '',
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
      if (!form.medicalTrackingId && !selectedArtifact?._id) {
        throw new Error('Select a medical tracking record or medical artifact first');
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
          assignedToUserId: form.assignedToUserId,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          ekgReviewDecision: form.ekgReviewDecision || undefined,
          ekgReviewNotes: form.ekgReviewNotes,
          liverReviewDecision: form.liverReviewDecision || undefined,
          liverReviewNotes: form.liverReviewNotes,
        });
      } else {
        const payload = {
          clientId: form.clientId,
          retreatId: form.retreatId || undefined,
          requestType: form.requestType,
          status: form.status,
          assignedTo: form.assignedTo,
          assignedToUserId: form.assignedToUserId,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          ekgReviewDecision: form.ekgReviewDecision || undefined,
          ekgReviewNotes: form.ekgReviewNotes,
          liverReviewDecision: form.liverReviewDecision || undefined,
          liverReviewNotes: form.liverReviewNotes,
        };
        if (selectedArtifact?._id) {
          await medicalReviewRequestsApi.createFromArtifact(selectedArtifact._id, form.requestType, payload);
        } else {
          await medicalReviewRequestsApi.create({ ...payload, medicalTrackingId: form.medicalTrackingId } as any);
        }
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
                <div className="mt-1 capitalize text-blue-800">{selectedArtifact.artifactType.replace(/_/g, ' ')}</div>
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
              {selectedArtifact ? (
                <div className="sm:col-span-2">
                  <div className="mb-2 font-medium text-gray-700">Linked files</div>
                  {selectedArtifact.files?.length ? (
                    <div className="space-y-2">
                      {selectedArtifact.files.map((file, index) => {
                        const fileUrl = getArtifactFileUrl(file);
                        return (
                          <div key={`${file.fileName || file.s3Key || index}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                            <div className="font-medium text-gray-900">{file.fileName || `File ${index + 1}`}</div>
                            <div className="mt-1 break-all text-xs text-gray-500">{file.s3Key || file.filePath || 'No storage path recorded'}</div>
                            {fileUrl ? (
                              <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                                Open file
                              </a>
                            ) : (
                              <div className="mt-2 text-xs text-gray-500">File URL is not available from the API.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-gray-500">No files are attached to this medical artifact.</div>
                  )}
                </div>
              ) : (
                <>
                  <div>EKG: {selectedTracking?.ekgFileName || 'No file'}</div>
                  <div>Liver: {selectedTracking?.liverPanelFileName || 'No file'}</div>
                </>
              )}
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
                <select
                  value={form.assignedToUserId}
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
                  <option value="">Select medical user</option>
                  {medicalUsers.map((medicalUser) => (
                    <option key={medicalUser._id} value={medicalUser._id}>
                      {[medicalUser.firstName, medicalUser.lastName].filter(Boolean).join(' ') || medicalUser.email} ({medicalUser.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Requested By</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || user?.username || form.requestedBy}
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
