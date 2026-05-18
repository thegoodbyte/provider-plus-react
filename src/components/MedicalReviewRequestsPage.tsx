import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewRequest } from '../types';

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

const getId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id;
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
  const [reviewDecision, setReviewDecision] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [ekgDecision, setEkgDecision] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [ekgNotes, setEkgNotes] = useState('');
  const [liverDecision, setLiverDecision] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [liverNotes, setLiverNotes] = useState('');
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
          const historyResponse = await medicalReviewRequestsApi.getByClientAndRetreat(clientId, retreatId);
          setHistory(historyResponse.data || []);
        } else {
          setHistory([]);
        }
        setReviewDecision(selectedItem.reviewDecision || '');
        setReviewNotes(selectedItem.reviewNotes || '');
        setOverallNotes(selectedItem.overallNotes || '');
        setEkgDecision(selectedItem.ekgReviewDecision || '');
        setEkgNotes(selectedItem.ekgReviewNotes || '');
        setLiverDecision(selectedItem.liverReviewDecision || '');
        setLiverNotes(selectedItem.liverReviewNotes || '');
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Error loading review requests:', error);
      setRequests([]);
      setSelected(null);
      setHistory([]);
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

  const handleSelect = (request: MedicalReviewRequest) => {
    setSelected(request);
    navigate(`${isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests'}/${request._id}`);
  };

  const handleSaveReview = async () => {
    if (!selected?._id) return;
    await medicalReviewRequestsApi.review(selected._id, {
      status: reviewDecision === 'OK' ? 'approved' : reviewDecision === 'NOT OK' ? 'rejected' : 'caution',
      reviewDecision: reviewDecision || undefined,
      reviewNotes,
      overallNotes,
      ekgReviewDecision: ekgDecision || undefined,
      ekgReviewNotes: ekgNotes,
      liverReviewDecision: liverDecision || undefined,
      liverReviewNotes: liverNotes,
      reviewedBy: 'medical_staff',
    });
    await loadRequests();
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review requests..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isMedicalRoute ? 'Medical Review Requests' : 'Medical Review Requests'}
          </h1>
          <p className="text-sm text-gray-600">
            {isMedicalRoute ? 'Queue for review and commentary on EKG and liver records.' : 'Administrative review request queue and history.'}
          </p>
        </div>
        {!isMedicalRoute && (
          <button
            onClick={() => navigate('/admin/medical-review-requests/new')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Request
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
                        {request.requestType} • Attempt {request.attemptNumber || 1} • {request.source || 'Provider Plus CRM'}
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
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[selected.status] || 'bg-gray-100 text-gray-700'}`}>
                  {selected.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Tracking</div>
                  <div className="mt-1 text-sm text-gray-900">{typeof selected.medicalTrackingId === 'string' ? selected.medicalTrackingId : selected.medicalTrackingId?._id || '—'}</div>
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Attempt</div>
                  <div className="mt-1 text-sm text-gray-900">{selected.attemptNumber || 1}</div>
                </div>
              </div>

              {selected.sourceSnapshot && (
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
                  <div className="mb-2 text-sm font-semibold text-gray-900">Overall notes</div>
                  <textarea value={overallNotes} onChange={(e) => setOverallNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Additional information or context" />
                </div>
              </div>

              {(selected.requestType === 'ekg' || selected.requestType === 'both') && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">EKG review</div>
                  <div className="flex flex-wrap gap-2">
                    {decisionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setEkgDecision(option)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${ekgDecision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <textarea value={ekgNotes} onChange={(e) => setEkgNotes(e.target.value)} rows={3} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="EKG comment" />
                </div>
              )}

              {(selected.requestType === 'liver' || selected.requestType === 'both') && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="mb-2 text-sm font-semibold text-gray-900">Liver review</div>
                  <div className="flex flex-wrap gap-2">
                    {decisionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setLiverDecision(option)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${liverDecision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <textarea value={liverNotes} onChange={(e) => setLiverNotes(e.target.value)} rows={3} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Liver comment" />
                </div>
              )}

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewRequestsPage;
