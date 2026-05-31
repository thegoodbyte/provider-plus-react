import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Client, MedicalArtifact, MedicalReviewRequest } from '../types';

const reviewStatusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const decisionOptions = ['OK', 'caution', 'NOT OK'] as const;

const requestTypeLabels: Record<string, string> = {
  ekg: 'EKG',
  liver: 'Liver Panel',
  both: 'EKG + Liver Panel',
  ekg_review: 'Entry EKG Review',
  ceremony_ekg_review: 'Ceremony EKG Review',
  blood_pressure_review: 'Blood Pressure Review',
  liver_panel_review: 'Liver Panel Review',
  medications_review: 'Medications Review',
  questionnaire_review: 'Questionnaire Review',
  food_review: 'Food Intake Review',
  medical_question: 'Medical Question',
  general_clearance: 'General Clearance',
};

const artifactTypeLabels: Record<string, string> = {
  ekg: 'Entry EKG',
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

const getId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id;
};

type ArtifactFile = NonNullable<MedicalArtifact['files']>[number];
type FileReviewDraft = {
  artifactId?: string;
  fileKey?: string;
  fileName?: string;
  decision?: 'OK' | 'caution' | 'NOT OK' | '';
  notes?: string;
};

const getArtifactFileUrl = (file: ArtifactFile) => file.url || file.filePath || file.s3Key || '';
const getArtifactFileKey = (file: ArtifactFile) => file.s3Key || file.filePath || file.url || file.fileName || '';
const isImageFile = (file: ArtifactFile) => Boolean(file.mimeType?.startsWith('image/'));
const isPdfFile = (file: ArtifactFile) => file.mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(file.fileName || '');

const ArtifactInlinePreview: React.FC<{ file: ArtifactFile; index: number }> = ({ file, index }) => {
  const url = getArtifactFileUrl(file);
  if (!url) return null;

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50">
      {isImageFile(file) && (
        <img src={url} alt={file.fileName || `Medical file ${index + 1}`} className="max-h-64 w-full rounded-t-md bg-white object-contain" />
      )}
      {isPdfFile(file) && (
        <iframe src={url} title={file.fileName || `Medical PDF ${index + 1}`} className="h-64 w-full rounded-t-md bg-white" />
      )}
      {!isImageFile(file) && !isPdfFile(file) && (
        <div className="p-3 text-xs text-gray-600">Preview unavailable for this file type.</div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-2 text-xs">
        <span className="truncate text-gray-700">{file.fileName || `File ${index + 1}`}</span>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-blue-700 hover:text-blue-900">
          Open
        </a>
      </div>
    </div>
  );
};

const MedicalReviewRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isMedicalRoute = location.pathname.startsWith('/medical/');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [selected, setSelected] = useState<MedicalReviewRequest | null>(null);
  const [history, setHistory] = useState<MedicalReviewRequest[]>([]);
  const [relatedArtifacts, setRelatedArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewDecision, setReviewDecision] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [medicalStaffNotes, setMedicalStaffNotes] = useState('');
  const [fileReviews, setFileReviews] = useState<FileReviewDraft[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | MedicalReviewRequest['status']>('all');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = isMedicalRoute
        ? await medicalReviewRequestsApi.getQueue()
        : await medicalReviewRequestsApi.getAll();
      const items = response.data || [];
      setRequests(items);

      const selectedId = id || items[0]?._id;
      let selectedItem = selectedId ? items.find((item: MedicalReviewRequest) => item._id === selectedId) || null : null;
      if (selectedId && !selectedItem) {
        const selectedResponse = await medicalReviewRequestsApi.getOne(selectedId);
        selectedItem = selectedResponse.data || null;
        if (selectedItem) {
          items.unshift(selectedItem);
          setRequests(items);
        }
      }
      setSelected(selectedItem);

      if (selectedItem) {
        const clientId = getId(selectedItem.clientId);
        const retreatId = getId(selectedItem.retreatId);
        if (clientId && retreatId) {
          const [historyResponse, artifactsResponse] = await Promise.all([
            medicalReviewRequestsApi.getByClientAndRetreat(clientId, retreatId),
            medicalArtifactsApi.getAll({ clientId }),
          ]);
          setHistory(historyResponse.data || []);
          setRelatedArtifacts(artifactsResponse.data || []);
        } else if (clientId) {
          const artifactsResponse = await medicalArtifactsApi.getAll({ clientId });
          setRelatedArtifacts(artifactsResponse.data || []);
        } else {
          setHistory([]);
          setRelatedArtifacts([]);
        }
        setReviewDecision(selectedItem.reviewDecision || '');
        setReviewNotes(selectedItem.reviewNotes || '');
        setOverallNotes(selectedItem.overallNotes || '');
        setMedicalStaffNotes(selectedItem.medicalStaffNotes || '');
        setFileReviews((selectedItem.fileReviews || []).map((review: NonNullable<MedicalReviewRequest['fileReviews']>[number]) => ({
          ...review,
          decision: review.decision || '',
        })));
      } else {
        setHistory([]);
        setRelatedArtifacts([]);
      }
    } catch (error) {
      console.error('Error loading review requests:', error);
      setRequests([]);
      setSelected(null);
      setHistory([]);
      setRelatedArtifacts([]);
    } finally {
      setLoading(false);
    }
  }, [id, isMedicalRoute]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    const currentId = selected._id;
    return history
      .filter((item) => item._id !== currentId)
      .sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0));
  }, [history, selected]);

  const selectedArtifactIds = useMemo(() => {
    return new Set((selected?.artifactIds || []).map((artifact) => getId(artifact)));
  }, [selected]);

  const linkedArtifacts = useMemo(() => {
    if (!selected) return [];
    const populated = (selected.artifactIds || []).filter((artifact): artifact is MedicalArtifact => typeof artifact !== 'string');
    if (populated.length) return populated;
    return relatedArtifacts.filter((artifact) => artifact._id && selectedArtifactIds.has(artifact._id));
  }, [relatedArtifacts, selected, selectedArtifactIds]);

  const profileHref = useMemo(() => {
    const clientId = getId(selected?.clientId);
    if (!clientId) return undefined;
    return `${isMedicalRoute ? '/medical/client' : '/admin/medical'}/${clientId}`;
  }, [isMedicalRoute, selected]);

  const handleSelect = (request: MedicalReviewRequest) => {
    setSelected(request);
    navigate(`${isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests'}/${request._id}`);
  };

  const handleSaveReview = async () => {
    if (!selected?._id) return;
    const cleanedFileReviews = fileReviews
      .filter((review) => review.fileKey || review.fileName || review.notes || review.decision)
      .map((review) => ({
        ...review,
        decision: review.decision || undefined,
      }));
    await medicalReviewRequestsApi.review(selected._id, {
      status: reviewDecision === 'OK' ? 'approved' : reviewDecision === 'NOT OK' ? 'rejected' : reviewDecision === 'caution' ? 'caution' : 'in_review',
      reviewDecision: reviewDecision || undefined,
      reviewNotes,
      overallNotes,
      medicalStaffNotes,
      fileReviews: cleanedFileReviews,
      reviewedBy: 'medical_staff',
    });
    await loadRequests();
  };

  const updateFileReview = (artifact: MedicalArtifact, file: ArtifactFile, patch: Partial<FileReviewDraft>) => {
    const artifactId = artifact._id;
    const fileKey = getArtifactFileKey(file);
    setFileReviews((prev) => {
      const existingIndex = prev.findIndex((review) => review.artifactId === artifactId && review.fileKey === fileKey);
      const nextReview = {
        artifactId,
        fileKey,
        fileName: file.fileName,
        ...(existingIndex >= 0 ? prev[existingIndex] : {}),
        ...patch,
      };
      if (existingIndex < 0) return [...prev, nextReview];
      return prev.map((review, index) => index === existingIndex ? nextReview : review);
    });
  };

  const getFileReview = (artifact: MedicalArtifact, file: ArtifactFile) => {
    const artifactId = artifact._id;
    const fileKey = getArtifactFileKey(file);
    return fileReviews.find((review) => review.artifactId === artifactId && review.fileKey === fileKey) || {};
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review requests..." />;
  }

  const isDetailView = Boolean(id);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isDetailView && selected ? `Medical Review Request #${selected.display_id || '—'}` : 'Medical Review Requests'}
          </h1>
          <p className="text-sm text-gray-600">
            {isDetailView ? 'Review the linked files and record a final decision.' : isMedicalRoute ? 'Queue for review and commentary on medical records, ceremony EKG, and blood pressure.' : 'Administrative review request queue and history.'}
          </p>
        </div>
        {!isMedicalRoute && !isDetailView && (
          <button
            onClick={() => navigate('/admin/medical-review-requests/new')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Request
          </button>
        )}
      </div>

      {!isDetailView && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <label htmlFor="review-request-status-filter" className="text-sm font-medium text-gray-700">Status</label>
          <select
            id="review-request-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      )}

      <div className={isDetailView ? 'grid gap-6' : 'grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'}>
        {!isDetailView && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Queue</div>
            <div className="max-h-[70vh] overflow-auto">
              {filteredRequests.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No review requests found.</div>
              ) : (
                filteredRequests.map((request) => (
                  <button
                    key={request._id}
                    onClick={() => handleSelect(request)}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${selected?._id === request._id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          #{request.display_id || '—'} {typeof request.clientId === 'string' ? request.clientId : request.clientId?.display_id ? `#${request.clientId.display_id}` : 'Client'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {requestTypeLabels[request.requestType] || request.requestType} • Attempt {request.attemptNumber || 1} • {request.source || 'Provider Plus CRM'}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[request.status] || 'bg-gray-100 text-gray-700'}`}>
                        {request.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {!selected ? (
            <div className="p-4 text-sm text-gray-500">Select a request to review it.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">#{selected.display_id || '—'} Review Request</h2>
                  <div className="text-sm text-gray-600">
                    {typeof selected.clientId === 'string' ? selected.clientId : selected.clientId?.firstName ? `${selected.clientId.firstName} ${selected.clientId.lastName}` : 'Unknown client'}
                    {' '}• {typeof selected.retreatId === 'string' ? selected.retreatId : selected.retreatId?.name || 'Unknown retreat'}
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900">{requestTypeLabels[selected.requestType] || selected.requestType}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[selected.status] || 'bg-gray-100 text-gray-700'}`}>
                  {selected.status}
                </span>
              </div>

              {!isDetailView && (
                <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Client Context</div>
                  {profileHref ? (
                    <button type="button" onClick={() => navigate(profileHref)} className="mt-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
                      Open full medical profile
                    </button>
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">No client profile link</div>
                  )}
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Attempt</div>
                  <div className="mt-1 text-sm text-gray-900">{selected.attemptNumber || 1}</div>
                </div>
                </div>
              )}

              <div className="rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Linked Files For This Request</div>
                    <div className="text-xs text-gray-500">These are the stored files included in this medical review request.</div>
                  </div>
                  {profileHref && (
                    <button type="button" onClick={() => navigate(profileHref)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Full Profile
                    </button>
                  )}
                </div>
                <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                  {linkedArtifacts.length === 0 ? (
                    <div className="text-sm text-gray-500">No linked files are available for this request.</div>
                  ) : (
                    linkedArtifacts.map((artifact) => {
                      const client = typeof artifact.clientId === 'string' ? undefined : artifact.clientId as Client;
                      return (
                        <div key={artifact._id} className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">
                                #{artifact.display_id || '—'} {artifactTypeLabels[artifact.artifactType] || artifact.artifactType}: {artifact.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {client ? `${client.firstName} ${client.lastName}` : 'Client record'} • {artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleString() : 'No received date'}
                              </div>
                            </div>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">This request</span>
                          </div>
                          {artifact.textContent && <div className="mt-2 whitespace-pre-wrap text-gray-700">{artifact.textContent}</div>}
                          {artifact.notes && <div className="mt-2 text-xs text-gray-600">Notes: {artifact.notes}</div>}
                          {artifact.data && Object.keys(artifact.data).length > 0 && (
                            <pre className="mt-2 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600">{JSON.stringify(artifact.data, null, 2)}</pre>
                          )}
                          {!!artifact.files?.length && (
                            <div className="mt-2 space-y-3">
                              {artifact.files.map((file, index) => {
                                const fileReview = getFileReview(artifact, file);
                                return (
                                  <div key={`${file.fileName || file.s3Key || index}`} className="rounded-md border border-gray-200 bg-white p-3">
                                    <ArtifactInlinePreview file={file} index={index} />
                                    <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                                      <select
                                        value={fileReview.decision || ''}
                                        onChange={(event) => updateFileReview(artifact, file, { decision: event.target.value as FileReviewDraft['decision'] })}
                                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                                      >
                                        <option value="">File decision</option>
                                        <option value="OK">Accept file</option>
                                        <option value="caution">Caution</option>
                                        <option value="NOT OK">Deny file</option>
                                      </select>
                                      <textarea
                                        value={fileReview.notes || ''}
                                        onChange={(event) => updateFileReview(artifact, file, { notes: event.target.value })}
                                        rows={2}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                        placeholder="Comment on this file"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!artifact.files?.length && (
                            <div className="mt-2 text-xs text-gray-500">This linked artifact has no uploaded files.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {!isDetailView && (
                <div className="rounded-md border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900">Other client medical artifacts</div>
                <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                  {relatedArtifacts.filter((artifact) => !artifact._id || !selectedArtifactIds.has(artifact._id)).length === 0 ? (
                    <div className="text-sm text-gray-500">No additional stored artifacts found for this client.</div>
                  ) : (
                    relatedArtifacts.filter((artifact) => !artifact._id || !selectedArtifactIds.has(artifact._id)).map((artifact) => (
                      <div key={artifact._id} className="rounded-md border border-gray-200 p-3 text-sm">
                        <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {artifactTypeLabels[artifact.artifactType] || artifact.artifactType}: {artifact.title}</div>
                        <div className="text-xs text-gray-500">{artifact.files?.length || 0} file(s)</div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              )}

              {!isDetailView && selected.sourceSnapshot && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">Source snapshot</div>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(selected.sourceSnapshot, null, 2)}</pre>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">Review decision</div>
                  <div className="flex flex-wrap gap-2">
                    {decisionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setReviewDecision(option)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${reviewDecision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={4} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="General review notes" />
                </div>

                <div className="rounded-md border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">Final notes</div>
                  <textarea value={overallNotes} onChange={(e) => setOverallNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Additional information or context" />
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-gray-900">Medical staff notes</div>
                <textarea value={medicalStaffNotes} onChange={(e) => setMedicalStaffNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Internal medical staff notes" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {selected.requestedAt ? `Requested ${new Date(selected.requestedAt).toLocaleString()}` : 'No request date'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests')}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReview}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Review
                  </button>
                </div>
              </div>

              {!isDetailView && (
                <div className="rounded-md border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900">Previous requests</div>
                <div className="mt-3 space-y-2">
                  {selectedHistory.length === 0 ? (
                    <div className="text-sm text-gray-500">No previous requests found.</div>
                  ) : (
                    selectedHistory.map((item) => (
                      <div key={item._id} className="rounded-md border border-gray-200 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-900">#{item.display_id || '—'} • Attempt {item.attemptNumber || 1}</div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[item.status] || 'bg-gray-100 text-gray-700'}`}>{item.status}</span>
                        </div>
                        <div className="mt-1 text-gray-600">
                          {item.reviewDecision || 'No decision'} • {item.reviewNotes || 'No notes'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewRequestsPage;
