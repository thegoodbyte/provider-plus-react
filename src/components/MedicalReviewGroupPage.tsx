import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronDown, FiChevronRight, FiCopy, FiFolder, FiLink, FiPlus, FiRefreshCw } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewGroup, MedicalReviewRequest } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const statusClass: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const getClientName = (request: any) => {
  const client = request.clientId && typeof request.clientId === 'object' ? request.clientId : {};
  return [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unknown client';
};

const getRetreatLabel = (request: any) => {
  const retreat = request.retreatId && typeof request.retreatId === 'object' ? request.retreatId : {};
  return retreat.code || retreat.retreatCode || retreat.name || 'Unknown retreat';
};

const getPacketRetreatLabel = (group: MedicalReviewGroup | null, request: MedicalReviewRequest) => {
  const retreatLabel = getRetreatLabel(request);
  return retreatLabel !== 'Unknown retreat' ? retreatLabel : (group?.retreatName || 'Unknown retreat');
};

const isPendingReview = (request: MedicalReviewRequest) => request.status === 'pending' || request.status === 'in_review';

const getRequestKey = (request: MedicalReviewRequest) => request._id || '';

type PacketSection = {
  key: string;
  title: string;
  subtitle?: string;
  requests: MedicalReviewRequest[];
};

const buildPacketSections = (group: MedicalReviewGroup | null, requests: MedicalReviewRequest[]): PacketSection[] => {
  const byKey = new Map<string, MedicalReviewRequest[]>();
  for (const request of requests || []) {
    const retreatLabel = getPacketRetreatLabel(group, request);
    const ceremonyNumber = request.ceremonyNumber || (request as any).ceremonyNumber;
    const sectionKey = group?.groupType === 'ceremony'
      ? `ceremony:${ceremonyNumber || 'unknown'}`
      : `retreat:${retreatLabel}`;
    const bucket = byKey.get(sectionKey) || [];
    bucket.push(request);
    byKey.set(sectionKey, bucket);
  }

  return Array.from(byKey.entries())
    .map(([key, sectionRequests]) => {
      const sorted = [...sectionRequests].sort((a, b) => String(a.requestType || '').localeCompare(String(b.requestType || '')) || String(getClientName(a)).localeCompare(getClientName(b)));
      if (key.startsWith('ceremony:')) {
        const ceremony = key.split(':')[1];
        return {
          key,
          title: ceremony === 'unknown' ? 'Ceremony group' : `Ceremony #${ceremony}`,
          subtitle: `${sorted.length} request${sorted.length === 1 ? '' : 's'}`,
          requests: sorted,
        };
      }
      const retreatLabel = key.slice('retreat:'.length);
      return {
        key,
        title: retreatLabel,
        subtitle: `${sorted.length} request${sorted.length === 1 ? '' : 's'}`,
        requests: sorted,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
};

const MedicalReviewGroupPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<MedicalReviewGroup | null>(null);
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingLink, setIssuingLink] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [allRequests, setAllRequests] = useState<MedicalReviewRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const loadGroup = useCallback(async () => {
    const [groupResponse, linksResponse] = await Promise.all([
      medicalReviewRequestsApi.getGroup(id),
      medicalReviewRequestsApi.getGroupAccessLinks(id),
    ]);
    setGroup(groupResponse.data);
    setAccessLinks(linksResponse.data || []);
    const currentRequests = ((groupResponse.data?.requests || []) as MedicalReviewRequest[]).filter(isPendingReview);
    setExpandedSections((current) => {
      const sections = buildPacketSections(groupResponse.data || null, currentRequests).map((section) => section.key);
      return Array.from(new Set([...current, ...sections]));
    });
  }, [id]);

  useEffect(() => {
    let mounted = true;
    loadGroup()
      .catch((requestError) => {
        if (mounted) setError(requestError?.response?.data?.message || 'Unable to load grouped review.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadGroup]);

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy link', value);
    }
  };

  const issueNewLink = async () => {
    try {
      setIssuingLink(true);
      const response = await medicalReviewRequestsApi.issueGroupAccessLink(id);
      setAccessLinks((current) => [response.data, ...current]);
      if (response.data?.url) {
        await copyToClipboard(response.data.url);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to issue grouped review link.');
    } finally {
      setIssuingLink(false);
    }
  };

  const openAddModal = async () => {
    setAddModalOpen(true);
    setRequestSearch('');
    setSelectedRequestIds([]);
    try {
      const retreatId = typeof group?.retreatId === 'string' ? group.retreatId : group?.retreatId?._id;
      const response = await medicalReviewRequestsApi.getAll(retreatId ? { retreatId } : {});
      const existingIds = new Set((group?.reviewRequestIds || []).map((value) => String(value)));
      const candidates = (response.data || []).filter((request: MedicalReviewRequest) => !existingIds.has(getRequestKey(request)));
      setAllRequests(candidates);
    } catch {
      setAllRequests([]);
    }
  };

  const toggleSelectedRequest = (requestId: string) => {
    setSelectedRequestIds((current) => (
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId]
    ));
  };

  const appendRequestsToGroup = async () => {
    if (!selectedRequestIds.length) return;
    try {
      setSavingGroup(true);
      await medicalReviewRequestsApi.updateGroup(id, { reviewRequestIds: selectedRequestIds });
      setAddModalOpen(false);
      await loadGroup();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to add requests to this packet.');
    } finally {
      setSavingGroup(false);
    }
  };

  const sections = useMemo(() => {
    const groupRequests = ((group?.requests || []) as MedicalReviewRequest[]).filter(isPendingReview);
    return buildPacketSections(group, groupRequests);
  }, [group]);
  const filteredCandidates = useMemo(() => {
    const search = requestSearch.trim().toLowerCase();
    if (!search) return allRequests;
    return allRequests.filter((request) => [
      request.display_id,
      getClientName(request),
      getRetreatLabel(request),
      request.requestType,
      request.documentType,
      request.documentStage,
    ].filter(Boolean).join(' ').toLowerCase().includes(search));
  }, [allRequests, requestSearch]);

  if (loading) return <LoadingSpinner message="Loading grouped review..." />;
  if (error) return <div className="p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Grouped medical review packet</div>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900">{group?.title || 'Medical review packet'}</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                {group?.retreatName || 'No retreat'}{group?.ceremonyNumber ? ` • Ceremony #${group.ceremonyNumber}` : ''} • {(group?.requests || []).filter(isPendingReview).length} pending request{(group?.requests || []).filter(isPendingReview).length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Use the permanent link below. It only shows pending reviews in this packet.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {group?.url && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(group.url || '')}
                    className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Icon icon={FiCopy} className="h-4 w-4" />
                    Copy permanent link
                  </button>
                )}
                <button
                  type="button"
                  onClick={issueNewLink}
                  disabled={issuingLink}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Icon icon={FiLink} className="h-4 w-4" />
                  {issuingLink ? 'Issuing...' : 'Issue new link'}
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Icon icon={FiPlus} className="h-4 w-4" />
                  Add requests
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{group?.groupType || 'custom'} packet</div>
              <div className="mt-1">{accessLinks.length} link{accessLinks.length === 1 ? '' : 's'} issued</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Issued links</h2>
              <p className="text-xs text-gray-500">The permanent packet link stays valid while you issue additional access links for the same packet.</p>
            </div>
            <button
              type="button"
              onClick={() => loadGroup().then(() => undefined)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Icon icon={FiRefreshCw} className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {accessLinks.length > 0 ? accessLinks.map((link) => (
              <div key={`${link.tokenHash || link.url || link.createdAt}`} className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{link.label || 'Group link'}</div>
                  <div className="text-xs text-gray-500">
                    {link.status || 'active'}{link.accessCount ? ` • accessed ${link.accessCount}x` : ''}{link.createdAt ? ` • created ${new Date(link.createdAt).toLocaleString()}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(link.url || '')}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Icon icon={FiCopy} className="h-4 w-4" />
                  Copy
                </button>
              </div>
            )) : (
              <div className="text-sm text-gray-500">No issued links yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {sections.length > 0 ? sections.map((section) => {
            const expanded = expandedSections.includes(section.key);
            return (
              <div key={section.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 text-left"
                  onClick={() => setExpandedSections((current) => (
                    current.includes(section.key)
                      ? current.filter((value) => value !== section.key)
                      : [...current, section.key]
                  ))}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                      <Icon icon={FiFolder} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{section.title}</div>
                      <div className="text-xs text-gray-500">{section.subtitle}</div>
                    </div>
                  </div>
                  <Icon icon={expanded ? FiChevronDown : FiChevronRight} className="h-5 w-5 shrink-0 text-gray-500" />
                </button>
                {expanded && (
                  <div className="divide-y divide-gray-100">
                    {section.requests.map((request) => (
                      <div key={request._id} className="grid gap-3 px-4 py-4 md:grid-cols-[150px_minmax(0,1fr)_220px_150px_130px] md:items-center">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/medical/review-requests/${request._id}/edit`)}
                            className="text-left text-sm font-semibold text-blue-700 hover:underline"
                          >
                            #{request.display_id || '-'}
                          </button>
                          <div className="mt-1 text-xs text-gray-500">{request.requestType || 'review'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{getClientName(request)}</div>
                          <div className="truncate text-xs text-gray-500">{getRetreatLabel(request)}</div>
                        </div>
                        <div className="min-w-0">
                          <MedicalReviewTypeBadge requestType={request.requestType} />
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="flex justify-start md:justify-end">
                          <button
                            type="button"
                            onClick={() => navigate(`/medical/review-requests/${request._id}/edit`)}
                            className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Open review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
              No pending reviews in this packet.
            </div>
          )}
        </div>
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add requests to packet</h2>
                <p className="mt-1 text-sm text-gray-600">The packet link stays the same. This only appends more requests to the existing link.</p>
              </div>
              <button type="button" onClick={() => setAddModalOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Close">
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-160px)] overflow-y-auto px-5 py-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Search</span>
                <input
                  value={requestSearch}
                  onChange={(event) => setRequestSearch(event.target.value)}
                  placeholder="Search client, retreat, request type..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                {filteredCandidates.length > 0 ? filteredCandidates.map((request) => {
                  const requestId = getRequestKey(request);
                  return (
                    <label key={requestId} className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.includes(requestId)}
                        onChange={() => toggleSelectedRequest(requestId)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-semibold text-gray-900">#{request.display_id || '-'}</div>
                        <div className="truncate text-gray-800">{getClientName(request)}</div>
                        <div className="truncate text-xs text-gray-500">{getRetreatLabel(request)} • {request.requestType || 'review'}</div>
                      </div>
                      <MedicalReviewTypeBadge requestType={request.requestType} />
                    </label>
                  );
                }) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">No requests available to add.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={appendRequestsToGroup}
                disabled={savingGroup || !selectedRequestIds.length}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingGroup ? 'Saving...' : `Add ${selectedRequestIds.length || ''} request${selectedRequestIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalReviewGroupPage;
