import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import SearchableMedicalTrackingSelect from './SearchableMedicalTrackingSelect';
import { clientsApi, medicalArtifactsApi, medicalReviewRequestsApi, medicalTrackingApi, retreatsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { useAuth } from '../context/AuthContext';
import { Client, MedicalArtifact, MedicalItem, MedicalReviewGroup, MedicalReviewRequest, Retreat } from '../types';
import { groupMatchesRetreat } from './MedicalReviewRequestEditorPage.helpers';
import './MedicalReviewRequestEditorPage.css';

type FormState = {
  medicalTrackingId: string;
  clientId: string;
  retreatId: string;
  medicalReviewGroupId: string;
  artifactIds: string[];
  documentStage: NonNullable<MedicalArtifact['documentStage']> | '';
  documentType: NonNullable<MedicalArtifact['documentType']> | '';
  ceremonyNumber: number | '';
  requestType: NonNullable<MedicalReviewRequest['requestType']>;
  status: MedicalReviewRequest['status'];
  requestedBy: string;
  sentForReviewAt: string;
  assignedTo: string;
  assignedToUserId: string;
  reviewDecision: 'OK' | 'caution' | 'more_info_needed' | 'NOT OK' | '';
  reviewNotes: string;
  overallNotes: string;
  medicalStaffNotes: string;
  clientVisibleAdminNote: string;
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

const getObjectId = (value: string | { _id?: string; id?: string } | undefined | null) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getRecordId = (value: string | { _id?: string } | undefined | null) => {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id || '';
};

const getClientLabel = (client?: string | Client | null) => {
  if (!client) return '';
  if (typeof client === 'string') return client;
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return [`Client #${client.display_id || '—'}`, name || client.email || 'Unknown client'].filter(Boolean).join(' · ');
};

const getBookingLabel = (artifact?: MedicalArtifact | null) => {
  const booking = artifact?.bookingId;
  if (!booking) return '';
  if (typeof booking === 'string') return `Booking ${booking.slice(-6)}`;
  const bookingNumber = booking.bookingNumber || (booking as any).display_id;
  const bookingClient = booking.clientId as any;
  const clientName = bookingClient && typeof bookingClient === 'object'
    ? [bookingClient.firstName || bookingClient.fname, bookingClient.lastName || bookingClient.lname].filter(Boolean).join(' ')
    : '';
  return [bookingNumber ? `Booking #${bookingNumber}` : `Booking ${getObjectId(booking).slice(-6)}`, clientName].filter(Boolean).join(' · ');
};

const getGroupLabel = (group?: MedicalReviewGroup | null) => {
  if (!group) return '';
  return [
    group.title,
    group.retreatName ? `(${group.retreatName})` : '',
    group.groupType || '',
  ].filter(Boolean).join(' · ');
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
  const [requestTypes, setRequestTypes] = useState<Array<{ key: NonNullable<MedicalReviewRequest['requestType']>; label: string }>>([]);
  const [reviewGroups, setReviewGroups] = useState<MedicalReviewGroup[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<MedicalArtifact | null>(null);
  const [clientArtifacts, setClientArtifacts] = useState<MedicalArtifact[]>([]);
  const [isArtifactModalOpen, setIsArtifactModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    medicalTrackingId: '',
    clientId: '',
    retreatId: '',
    medicalReviewGroupId: '',
    artifactIds: [],
    documentStage: '',
    documentType: '',
    ceremonyNumber: '',
    requestType: 'both',
    status: 'pending',
    requestedBy: 'Provider Plus CRM',
    sentForReviewAt: '',
    assignedTo: '',
    assignedToUserId: '',
    reviewDecision: '',
    reviewNotes: '',
    overallNotes: '',
    medicalStaffNotes: '',
    clientVisibleAdminNote: '',
  });

  const [loadedClientVisibleAdminNote, setLoadedClientVisibleAdminNote] = useState('');

  const [requestNumber, setRequestNumber] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [id, artifactId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trackingResponse, clientsResponse, retreatsResponse, groupsResponse, nextDisplayResponse, usersResponse, artifactResponse, requestTypesResponse] = await Promise.all([
        medicalTrackingApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        medicalReviewRequestsApi.getGroups().catch(() => ({ data: [] as MedicalReviewGroup[] })),
        medicalReviewRequestsApi.getNextDisplayId(),
        usersApi.getAll().catch(() => ({ data: [] as User[] })),
        artifactId ? medicalArtifactsApi.getOne(artifactId).catch(() => null) : Promise.resolve(null),
        medicalReviewRequestsApi.getRequestTypes(),
      ]);

      const clientById = new Map<string | undefined, Client>((clientsResponse.data || []).map((client: Client) => [client._id, client]));
      const retreatById = new Map<string | undefined, Retreat>((retreatsResponse.data || []).map((retreat: Retreat) => [retreat._id, retreat]));
      setTrackingItems((trackingResponse.data || []).map((item: MedicalItem) => {
        const client = clientById.get(item.client_id);
        const retreatId = getObjectId(item.retreatId as any);
        const retreat = retreatById.get(retreatId);
        return {
          ...item,
          clientDisplayId: item.clientDisplayId || client?.display_id,
          clientName: item.clientName || (client ? [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') : ''),
          firstName: item.firstName || client?.firstName || client?.fname,
          lastName: item.lastName || client?.lastName || client?.lname,
          retreatName: retreat?.retreatCode || retreat?.code || retreat?.name,
        };
      }));
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
      setReviewGroups((groupsResponse as any).data || []);
      setMedicalUsers((usersResponse.data || []).filter((item) => item.role === 'medical_advisor' && item.isActive !== false));
      setRequestNumber(nextDisplayResponse.data || null);
      setRequestTypes(requestTypesResponse.data || []);
      if (!isEdit && !artifactResponse?.data && requestTypesResponse.data?.length) {
        setForm((previous) => requestTypesResponse.data.some((type) => type.key === previous.requestType)
          ? previous
          : { ...previous, requestType: requestTypesResponse.data[0].key });
      }
      if (artifactResponse?.data) {
        const artifact = artifactResponse.data;
        setSelectedArtifact(artifact);
        setForm((prev) => ({
          ...prev,
          clientId: typeof artifact.clientId === 'string' ? artifact.clientId : artifact.clientId?._id || prev.clientId,
          retreatId: typeof artifact.retreatId === 'string' ? artifact.retreatId : artifact.retreatId?._id || prev.retreatId,
          medicalReviewGroupId: prev.medicalReviewGroupId,
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
          medicalReviewGroupId: typeof (record as any).medicalReviewGroupId === 'string' ? (record as any).medicalReviewGroupId : (record as any).medicalReviewGroupId?._id || '',
          artifactIds: (record.artifactIds || []).map((artifact: string | MedicalArtifact) => getRecordId(artifact)).filter(Boolean),
          documentStage: record.documentStage || record.artifactSnapshot?.documentStage as FormState['documentStage'] || '',
          documentType: record.documentType || record.artifactSnapshot?.documentType as FormState['documentType'] || '',
          ceremonyNumber: (record.ceremonyNumber || record.artifactSnapshot?.ceremonyNumber || '') as FormState['ceremonyNumber'],
          requestType: record.requestType,
          status: record.status,
          requestedBy: record.requestedBy || '',
          sentForReviewAt: record.sentForReviewAt ? new Date(record.sentForReviewAt).toISOString() : '',
          assignedTo: record.assignedTo || '',
          assignedToUserId: typeof record.assignedToUserId === 'string' ? record.assignedToUserId : record.assignedToUserId?._id || '',
          reviewDecision: record.reviewDecision || '',
          reviewNotes: record.reviewNotes || '',
          overallNotes: record.overallNotes || '',
          medicalStaffNotes: record.medicalStaffNotes || '',
          clientVisibleAdminNote: record.clientVisibleAdminNote || '',
        });
        setLoadedClientVisibleAdminNote(record.clientVisibleAdminNote || '');
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

  const selectedGroup = useMemo(
    () => reviewGroups.find((group) => group._id === form.medicalReviewGroupId),
    [reviewGroups, form.medicalReviewGroupId],
  );

  const createRequestReady = Boolean(form.medicalReviewGroupId && form.assignedToUserId);
  const submitDisabled = saving || (!isEdit && !createRequestReady);
  const submitHint = !form.medicalReviewGroupId
    ? 'Select a medical review packet to continue.'
    : !form.assignedToUserId
      ? 'Select a medical reviewer to continue.'
      : 'Ready to create this review request.';

  const matchingGroups = useMemo(() => {
    if (!form.retreatId) return reviewGroups;
    return reviewGroups.filter((group) => groupMatchesRetreat(group, form.retreatId, selectedRetreat));
  }, [form.retreatId, reviewGroups, selectedRetreat]);

  const packetOptions = useMemo(() => {
    const matchingIds = new Set(matchingGroups.map((group) => group._id).filter(Boolean));
    return [...reviewGroups].sort((left, right) => {
      const leftMatches = matchingIds.has(left._id);
      const rightMatches = matchingIds.has(right._id);
      if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
      return getGroupLabel(left).localeCompare(getGroupLabel(right));
    });
  }, [matchingGroups, reviewGroups]);

  useEffect(() => {
    if (!selectedTracking) return;
    setForm((prev) => ({
      ...prev,
      clientId: selectedTracking.client_id || prev.clientId,
      retreatId: selectedTracking.retreatId || prev.retreatId,
    }));
  }, [selectedTracking]);

  useEffect(() => {
    if (form.medicalReviewGroupId) return;
    if (matchingGroups.length === 1 && matchingGroups[0]._id) {
      setForm((prev) => ({ ...prev, medicalReviewGroupId: matchingGroups[0]._id || '' }));
    }
  }, [form.medicalReviewGroupId, matchingGroups]);

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
      if (!form.medicalReviewGroupId) {
        throw new Error('Select a medical review packet before creating the review request.');
      }

      if (isEdit && id) {
        await medicalReviewRequestsApi.update(id, {
          clientId: form.clientId,
          retreatId: form.retreatId,
          medicalReviewGroupId: form.medicalReviewGroupId,
          medicalTrackingId: form.medicalTrackingId,
          artifactIds: form.artifactIds,
          documentStage: form.documentStage || undefined,
          documentType: form.documentType || undefined,
          ceremonyNumber: form.ceremonyNumber || undefined,
          requestType: form.requestType,
          status: form.status,
          requestedBy: form.requestedBy,
          ...(form.sentForReviewAt ? { sentForReviewAt: form.sentForReviewAt } : {}),
          assignedTo: form.assignedTo,
          assignedToUserId: form.assignedToUserId,
          reviewDecision: form.reviewDecision || undefined,
          reviewNotes: form.reviewNotes,
          overallNotes: form.overallNotes,
          medicalStaffNotes: form.medicalStaffNotes,
        });
        if (isAdmin && form.clientVisibleAdminNote.trim() !== loadedClientVisibleAdminNote.trim()) {
          await medicalReviewRequestsApi.updateClientVisibleAdminNote(id, form.clientVisibleAdminNote);
        }
      } else {
        const payload = {
          clientId: form.clientId,
          retreatId: form.retreatId || undefined,
          medicalReviewGroupId: form.medicalReviewGroupId,
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
          ...(form.sentForReviewAt ? { sentForReviewAt: form.sentForReviewAt } : {}),
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
  const isAdmin = user?.role === 'admin' || user?.originalRole === 'admin';

  return (
    <div className="mrr-editor-page">
      <div className="mrr-editor-shell">
      <header className="mrr-editor-header">
        <div>
          <div className="mrr-editor-eyebrow"><span>Admin</span>{isEdit ? 'Review request' : 'New review round'}</div>
          <h1>{isEdit ? 'Edit Medical Review Request' : 'Add Medical Review Request'}</h1>
          <p>Assign a stored medical record to a reviewer. The request stays pending until they respond.</p>
        </div>
        <div className="mrr-request-context">
          <strong>Request #{requestNumber || '—'}</strong>
          {selectedClient && <span>{selectedClient.firstName} {selectedClient.lastName}</span>}
          {selectedRetreat && <small>{selectedRetreat.retreatCode || selectedRetreat.code || selectedRetreat.name}</small>}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mrr-editor-form">
        <div className="mrr-editor-columns">
          <section className="mrr-editor-pane mrr-artifact-pane">
            <div className="mrr-section-heading"><strong>The artifact</strong>{selectedArtifact && <button type="button" onClick={() => setIsArtifactModalOpen(true)}>Change record</button>}</div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Medical Record</label>
            {selectedArtifact ? (
              <div className="mrr-artifact-card">
                <span className="mrr-artifact-monogram">{selectedArtifact.artifactType === 'liver_panel' ? 'LP' : selectedArtifact.artifactType === 'ekg' ? 'EK' : 'MR'}</span>
                <div><strong>#{selectedArtifact.display_id || '—'} {selectedArtifact.title}</strong>
                <div className="capitalize">{formatArtifactType(selectedArtifact.artifactType)} · {selectedArtifact.files?.length || 0} file(s)</div>
                <small>
                  {formatDocumentMeta(selectedArtifact.documentStage, selectedArtifact.documentType, selectedArtifact.ceremonyNumber)}
                </small></div>
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
                    medicalReviewGroupId: prev.medicalReviewGroupId,
                    requestType: tracking?.ekgFileName && tracking?.liverPanelFileName ? 'both' : tracking?.ekgFileName ? 'ekg' : tracking?.liverPanelFileName ? 'liver' : prev.requestType,
                  }));
                }}
              />
            )}
            <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              <div>Client: {getClientLabel(selectedClient || selectedArtifact?.clientId || null) || form.clientId || '—'}</div>
              <div>Booking: {getBookingLabel(selectedArtifact) || '—'}</div>
              <div>Retreat: {selectedRetreat?.code || selectedRetreat?.retreatCode || selectedRetreat?.name || form.retreatId || '—'}</div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Medical Review Packet <span className="text-red-600">*</span></label>
                <select
                  value={form.medicalReviewGroupId}
                  required
                  onChange={(e) => setForm({ ...form, medicalReviewGroupId: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select packet</option>
                  {packetOptions.map((group) => (
                    <option key={group._id} value={group._id}>
                      {getGroupLabel(group)}{matchingGroups.some((match) => match._id === group._id) ? ' — matching retreat' : ''}
                    </option>
                  ))}
                </select>
                {reviewGroups.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">No medical review packets exist yet. Create one in Medical Review Requests first.</p>
                )}
                {reviewGroups.length > 0 && matchingGroups.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">No packet is linked to this retreat. You can still choose another available packet or create a retreat packet first.</p>
                )}
                {selectedGroup && (
                  <p className="mt-1 text-xs text-gray-500">
                    Selected packet: <span className="font-medium text-gray-700">{getGroupLabel(selectedGroup)}</span>
                  </p>
                )}
              </div>
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
                <div className="mrr-linked-files-heading mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-gray-700">Linked files</div>
                  <button
                    type="button"
                    onClick={() => setIsArtifactModalOpen(true)}
                    disabled={!form.clientId}
                    className="mrr-add-files-button rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
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
          </section>

          <section className="mrr-editor-pane mrr-assignment-pane">
            <div className="mrr-section-heading"><strong>Assignment</strong></div>
            <label className="mrr-field-label">Request type</label>
            <div className="mrr-type-options">
              {requestTypes.map(({ key, label }) => <button key={key} type="button" className={form.requestType === key ? 'selected' : ''} onClick={() => setForm({ ...form, requestType: key })}>{label}</button>)}
            </div>
            <div className="mrr-assignment-fields">
              {isEdit && <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  {(['pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>}
              <div className="mrr-reviewer-field">
                <label className="mrr-field-label">Medical reviewer <span>*</span><small>Required</small></label>
                <div className="mrr-reviewer-list">
                  {medicalUsers.map((medicalUser) => {
                    const name = [medicalUser.firstName, medicalUser.lastName].filter(Boolean).join(' ') || medicalUser.email;
                    const initials = [medicalUser.firstName, medicalUser.lastName].filter(Boolean).map(value => value?.[0]).join('').slice(0, 2) || 'MR';
                    const language = (medicalUser.preferredReviewLanguage || 'en').toUpperCase();
                    const understood = (medicalUser.understoodReviewLanguages || ['en']).map((item) => item.toUpperCase()).join(', ');
                    return <button key={medicalUser._id} type="button" className={form.assignedToUserId === medicalUser._id ? 'selected' : ''} onClick={() => setForm({ ...form, assignedToUserId: medicalUser._id || '', assignedTo: name })}><span>{initials}</span><strong>{name}<small>{medicalUser.email} · Reviews in {language} · Understands {understood}</small></strong></button>;
                  })}
                </div>
                {medicalUsers.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">No active medical advisors are available.</p>
                )}
              </div>
            </div>
            <div className="mrr-status-summary"><span><i />Pending</span><p>Set automatically on creation. The reviewer moves it forward once they open the packet.</p></div>
            <label className="mrr-notify-option">
              <input
                type="checkbox"
                checked={Boolean(form.sentForReviewAt)}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  sentForReviewAt: e.target.checked ? prev.sentForReviewAt || new Date().toISOString() : '',
                }))}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-medium text-gray-900">Notify the reviewer now</span>
                <span className="block text-xs text-gray-500">
                  {form.sentForReviewAt ? `Notification scheduled ${new Date(form.sentForReviewAt).toLocaleString()}` : 'Sends the packet by email as soon as the request is created.'}
                </span>
              </span>
            </label>
          </section>
        </div>

        {isEdit && isAdmin && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            {getRecordId(selectedArtifacts.find((artifact) => artifact.bookingId)?.bookingId as any) && <button type="button" onClick={() => { const artifact = selectedArtifacts.find((candidate) => candidate.bookingId); const params = new URLSearchParams({ medicalReviewRequestId: id || '', artifactId: getRecordId(artifact as any) || '' }); navigate(`/admin/bookings/${getRecordId(artifact?.bookingId as any)}/medication-stop-plan?${params}`); }} className="mb-4 rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Open medication preparation plan</button>}
            <label htmlFor="client-visible-admin-note" className="mb-2 block text-sm font-semibold text-indigo-950">
              Client-visible admin note
            </label>
            <p className="mb-3 text-sm text-indigo-800">
              This message is shown to the client in IbogaReady below their submitted medical form. Medical advisor notes above remain private.
            </p>
            <textarea
              id="client-visible-admin-note"
              value={form.clientVisibleAdminNote}
              onChange={(event) => setForm({ ...form, clientVisibleAdminNote: event.target.value })}
              rows={5}
              maxLength={5000}
              className="w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Write the message the client should see..."
            />
            <div className="mt-1 text-right text-xs text-indigo-700">{form.clientVisibleAdminNote.length}/5000</div>
          </div>
        )}

        <section className="mrr-notes-section">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Requested By</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || form.requestedBy}
            </div>
            {isEdit && (
              <>
                <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">Review Decision</label>
                <select value={form.reviewDecision} onChange={(e) => setForm({ ...form, reviewDecision: e.target.value as FormState['reviewDecision'] })} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="">Select</option>
                  <option value="OK">Approve</option>
                  <option value="caution">Caution</option>
                  <option value="more_info_needed">More Info Needed</option>
                  <option value="NOT OK">Declined</option>
                </select>
              </>
            )}
            <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">Overall Notes</label>
            <textarea value={form.overallNotes} onChange={(e) => setForm({ ...form, overallNotes: e.target.value })} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Medical Staff Notes</label>
            <textarea
              value={form.medicalStaffNotes}
              onChange={(e) => setForm({ ...form, medicalStaffNotes: e.target.value })}
              rows={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Instructions, context, or questions for the medical advisor"
            />
          </div>
        </section>

        <footer className="mrr-editor-actions">
          <p>{isEdit ? 'Review the changes before saving.' : submitHint}</p>
          <div>
          <button type="button" onClick={() => navigate('/admin/medical-review-requests')} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            title={!isEdit && !createRequestReady ? submitHint : undefined}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:opacity-70"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Request'}
          </button>
          </div>
        </footer>
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
    </div>
  );
};

export default MedicalReviewRequestEditorPage;
