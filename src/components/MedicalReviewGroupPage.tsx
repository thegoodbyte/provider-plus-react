import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiChevronRight, FiCopy, FiEdit2, FiFolder, FiLink, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import ResponsiveModal from './ResponsiveModal';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewGroup, MedicalReviewRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { buildPacketSections, getClientName, getRequestKey, getRetreatLabel, isPendingReview } from './MedicalReviewGroupPage.helpers';

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

const getGroupUserId = (value?: string | { _id?: string; id?: string } | null) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

type ConfirmAction =
  | { kind: 'revoke-link'; accessLinkId: string; title: string; message: string }
  | { kind: 'remove-request'; requestId: string; title: string; message: string }
  | { kind: 'delete-packet'; title: string; message: string };

const MedicalReviewGroupPage: React.FC = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/medical') ? '/medical/review-requests' : '/admin/medical-review-requests';
  const [group, setGroup] = useState<MedicalReviewGroup | null>(null);
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingLink, setIssuingLink] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [linkExpiryDays, setLinkExpiryDays] = useState('7');
  const [allRequests, setAllRequests] = useState<MedicalReviewRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<MedicalReviewGroup[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [packetEditMode, setPacketEditMode] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const canManageGroup = user?.role === 'admin' || user?.role === 'medical_staff';

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

  useEffect(() => {
    setTitleDraft(group?.title || '');
  }, [group?.title]);

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
      const expiresInDays = Number(linkExpiryDays);
      const response = await medicalReviewRequestsApi.issueGroupAccessLink(
        id,
        Number.isFinite(expiresInDays) && expiresInDays > 0 ? { expiresInDays } : {},
      );
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

  const revokeLink = async (accessLinkId?: string) => {
    if (!accessLinkId) return;
    setConfirmAction({
      kind: 'revoke-link',
      accessLinkId,
      title: 'Revoke packet link?',
      message: 'This link will stop working immediately.',
    });
  };

  const removeRequestFromGroup = async (requestId: string) => {
    if (!group?._id || !requestId) return;
    setConfirmAction({
      kind: 'remove-request',
      requestId,
      title: 'Remove MRR from packet?',
      message: 'The review request will stay in the system. Only the packet link will be updated.',
    });
  };

  const deletePacket = async () => {
    if (!group?._id) return;
    setConfirmAction({
      kind: 'delete-packet',
      title: `Delete packet "${group.title}"?`,
      message: 'This will not delete the MRRs.',
    });
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      setSavingGroup(true);
      if (confirmAction.kind === 'revoke-link') {
        const response = await medicalReviewRequestsApi.revokeGroupAccessLink(confirmAction.accessLinkId);
        setAccessLinks((current) => current.map((link) => (link._id === confirmAction.accessLinkId ? response.data : link)));
      } else if (confirmAction.kind === 'remove-request' && group?._id) {
        await medicalReviewRequestsApi.updateGroup(group._id, { removeReviewRequestIds: [confirmAction.requestId] });
        setGroup((current) => current ? {
          ...current,
          reviewRequestIds: (current.reviewRequestIds || []).filter((requestId) => requestId !== confirmAction.requestId),
          requests: (current.requests || []).filter((request) => getRequestKey(request) !== confirmAction.requestId),
        } : current);
      } else if (confirmAction.kind === 'delete-packet' && group?._id) {
        await medicalReviewRequestsApi.deleteGroup(group._id);
        navigate(basePath, { replace: true });
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to complete the action.');
    } finally {
      setConfirmAction(null);
      setSavingGroup(false);
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
      await medicalReviewRequestsApi.addRequestsToGroup(id, selectedRequestIds);
      setAddModalOpen(false);
      await loadGroup();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to add requests to this packet.');
    } finally {
      setSavingGroup(false);
    }
  };

  const saveTitle = async () => {
    if (!group?._id) return;
    try {
      setSavingGroup(true);
      const response = await medicalReviewRequestsApi.updateGroup(group._id, { title: titleDraft.trim() || group.title });
      setGroup((current) => current ? { ...current, title: response.data.title || titleDraft.trim() || current.title } : current);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to rename the packet.');
    } finally {
      setSavingGroup(false);
    }
  };

  const openMoveModal = async () => {
    setMoveModalOpen(true);
    setMoveTargetGroupId('');
    try {
      const response = await medicalReviewRequestsApi.getGroups();
      setAvailableGroups((response.data || []).filter((packet) => packet._id && packet._id !== group?._id));
    } catch {
      setAvailableGroups([]);
    }
  };

  const moveSelectedToExistingPacket = async () => {
    if (!group?._id || !moveTargetGroupId || !selectedRequestIds.length) return;
    try {
      setSavingGroup(true);
      await medicalReviewRequestsApi.updateGroup(moveTargetGroupId, { reviewRequestIds: selectedRequestIds });
      const remaining = (group.reviewRequestIds || []).filter((id) => !selectedRequestIds.includes(id));
      await medicalReviewRequestsApi.updateGroup(group._id, { replaceReviewRequestIds: remaining });
      setMoveModalOpen(false);
      await loadGroup();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to move requests to the selected packet.');
    } finally {
      setSavingGroup(false);
    }
  };

  const createPacketFromSelected = async () => {
    if (!group?._id || !selectedRequestIds.length) return;
    try {
      setSavingGroup(true);
      const retreatId = typeof group.retreatId === 'string' ? group.retreatId : group.retreatId?._id;
      const response = await medicalReviewRequestsApi.createGroup({
        title: `${group.title} copy`,
        groupType: group.groupType || 'custom',
        retreatId,
        ceremonyNumber: group.ceremonyNumber,
        reviewRequestIds: selectedRequestIds,
        reviewerUserId: getGroupUserId(group.reviewerUserId),
      } as any);
      const remaining = (group.reviewRequestIds || []).filter((id) => !selectedRequestIds.includes(id));
      await medicalReviewRequestsApi.updateGroup(group._id, { replaceReviewRequestIds: remaining });
      setMoveModalOpen(false);
      navigate(`/medical/review-groups/${response.data._id}`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to create a new packet from the selected requests.');
    } finally {
      setSavingGroup(false);
    }
  };

  const sections = useMemo(() => {
    const groupRequests = ((group?.requests || []) as MedicalReviewRequest[]).filter(isPendingReview);
    return buildPacketSections(group, groupRequests);
  }, [group]);
  const pendingRequestCount = (group?.requests || []).filter(isPendingReview).length;
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
    <div className="min-h-screen bg-white px-0 py-0 md:bg-gray-50 md:px-6 md:py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="border-b-2 border-gray-900 bg-white px-6 pb-5 pt-5 md:hidden">
          <div className="mb-5 flex items-center justify-between text-cyan-700"><span className="text-xl">☰</span><div className="flex gap-5 text-lg"><span>⌕</span><span>♧</span><span>☼</span></div></div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">Grouped medical review packet</div>
          <div className="mt-2 flex items-start justify-between gap-4"><h1 className="text-[28px] font-black leading-none tracking-tight text-gray-900">{group?.title || 'Medical review packet'}</h1><div className="pt-1 text-right text-[10px] font-bold uppercase tracking-[0.12em]">Retreat packet<div className="mt-1 text-[11px] font-normal normal-case tracking-normal text-gray-500">{accessLinks.length} link{accessLinks.length === 1 ? '' : 's'} issued</div></div></div>
          <p className="mt-5 text-[13px] text-gray-700">{group?.retreatName || 'No retreat'} <span className="mx-1 text-gray-400">|</span> <strong>{pendingRequestCount} pending request{pendingRequestCount === 1 ? '' : 's'}</strong></p>
          <p className="mt-3 max-w-[310px] text-[13px] leading-snug text-gray-600">Use the permanent link below. It only shows pending reviews in this packet.</p>
        </div>
        <div className="hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:block">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Grouped medical review packet</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className={`text-2xl font-semibold ${pendingRequestCount ? 'text-gray-900' : 'text-gray-400'}`}>{group?.title || 'Medical review packet'}</h1>
                {canManageGroup && (
                  <>
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      aria-label="Add MRR to packet"
                      title="Add MRR to packet"
                    >
                      <Icon icon={FiPlus} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPacketEditMode((current) => !current)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${packetEditMode ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700'} hover:bg-gray-50`}
                      aria-label={packetEditMode ? 'Stop editing packet' : 'Edit packet'}
                      title={packetEditMode ? 'Stop editing packet' : 'Edit packet'}
                    >
                      <Icon icon={FiEdit2} className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {canManageGroup && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    className="min-w-[260px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={saveTitle}
                    disabled={savingGroup}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    aria-label="Save title"
                    title="Save title"
                  >
                    <Icon icon={FiCheck} className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={deletePacket}
                    disabled={savingGroup}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                    aria-label="Delete packet"
                    title="Delete packet"
                  >
                    <Icon icon={FiTrash2} className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                {group?.retreatName || 'No retreat'}{group?.ceremonyNumber ? ` • Ceremony #${group.ceremonyNumber}` : ''} • {(group?.requests || []).filter(isPendingReview).length} pending request{(group?.requests || []).filter(isPendingReview).length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Use the permanent link below. It only shows pending reviews in this packet.
              </p>
              {canManageGroup && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
              {group?.url && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(group.url || '')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    aria-label="Copy permanent link"
                    title="Copy permanent link"
                  >
                    <Icon icon={FiCopy} className="h-4 w-4" />
                  </button>
              )}
              <label className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Expire in</span>
                <input
                  type="number"
                  min="1"
                  value={linkExpiryDays}
                  onChange={(event) => setLinkExpiryDays(event.target.value)}
                  className="w-16 border-0 p-0 text-sm outline-none focus:ring-0"
                />
                <span className="text-xs text-gray-500">days</span>
              </label>
              <button
                type="button"
                onClick={issueNewLink}
                disabled={issuingLink}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                aria-label={issuingLink ? 'Issuing...' : 'Issue new link'}
                title={issuingLink ? 'Issuing...' : 'Issue new link'}
              >
                <Icon icon={FiLink} className="h-4 w-4" />
              </button>
                  {packetEditMode && (
                    <button
                      type="button"
                      onClick={openMoveModal}
                      disabled={!selectedRequestIds.length}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Icon icon={FiFolder} className="h-4 w-4" />
                      Move selected
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{group?.groupType || 'custom'} packet</div>
              <div className="mt-1">{accessLinks.length} link{accessLinks.length === 1 ? '' : 's'} issued</div>
            </div>
          </div>
        </div>

        {canManageGroup && (
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
                <div key={link._id || `${link.tokenHash || link.url || link.createdAt}`} className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{link.label || 'Group link'}</div>
                    <div className="text-xs text-gray-500">
                      {link.status || 'active'}{link.accessCount ? ` • accessed ${link.accessCount}x` : ''}{link.createdAt ? ` • created ${new Date(link.createdAt).toLocaleString()}` : ''}{link.expiresAt ? ` • expires ${new Date(link.expiresAt).toLocaleString()}` : ''}
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
                  {!link.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revokeLink(link._id)}
                      className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              )) : (
                <div className="text-sm text-gray-500">No issued links yet.</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 px-6 pb-20 md:space-y-3 md:px-0 md:pb-0">
          {sections.length > 0 ? sections.map((section) => {
            const expanded = expandedSections.includes(section.key);
            return (
              <div key={section.key} className="overflow-hidden border-y-2 border-gray-900 bg-white md:rounded-2xl md:border md:border-gray-200 md:shadow-sm">
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
                      <div
                        key={request._id}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-gray-900 px-4 py-3 last:border-b-0 md:items-center md:border-0 md:py-4 ${canManageGroup ? 'md:grid-cols-[36px_150px_minmax(0,1fr)_220px_150px_130px]' : 'md:grid-cols-[150px_minmax(0,1fr)_220px_150px_130px]'}`}
                      >
                        {canManageGroup && packetEditMode && (
                          <div className="flex items-start justify-center">
                            <input
                              type="checkbox"
                              checked={selectedRequestIds.includes(request._id || '')}
                              onChange={() => toggleSelectedRequest(request._id || '')}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`/medical/review-requests/${request._id}/edit`)}
                            className="text-left text-sm font-bold text-cyan-800 hover:underline"
                          >
                            #{request.display_id || '-'}
                          </button>
                          <div className="mt-1 text-xs text-gray-700"><span className="mr-2 inline-block border border-gray-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide md:hidden">{request.requestType === 'medications_review' ? 'Medications' : request.requestType || 'review'}</span><span className="hidden md:inline">{request.requestType || 'review'}</span></div>
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
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/medical/review-requests/${request._id}/edit`)}
                              className="rounded-none bg-cyan-700 px-3 py-3 text-xs font-bold text-white hover:bg-cyan-800 md:rounded-md md:py-2"
                            >
                              Open review
                            </button>
                            {canManageGroup && packetEditMode && (
                              <button
                                type="button"
                                onClick={() => removeRequestFromGroup(request._id || '')}
                                disabled={savingGroup}
                                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                              >
                                Remove from packet
                              </button>
                            )}
                          </div>
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
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-gray-900 bg-white px-6 py-4 text-[11px] md:hidden">
          <span className="text-gray-600">Showing pending only</span>
          {group?.url && <button type="button" onClick={() => copyToClipboard(group.url || '')} className="font-medium text-cyan-800">Copy permanent link</button>}
        </div>
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add MRRs to packet</h2>
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

      {moveModalOpen && canManageGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Move or copy selected requests</h2>
                <p className="mt-1 text-sm text-gray-600">Move them to an existing packet or create a new packet from the selected requests.</p>
              </div>
              <button type="button" onClick={() => setMoveModalOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100">✕</button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Destination packet</span>
                <select
                  value={moveTargetGroupId}
                  onChange={(event) => setMoveTargetGroupId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select existing packet</option>
                  {availableGroups.map((packet) => (
                    <option key={packet._id} value={packet._id}>
                      {packet.title} ({packet.retreatName || 'No retreat'})
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-600">
                {selectedRequestIds.length} request{selectedRequestIds.length === 1 ? '' : 's'} selected
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={createPacketFromSelected}
                disabled={savingGroup || !selectedRequestIds.length}
                className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                Create new packet
              </button>
              <button
                type="button"
                onClick={moveSelectedToExistingPacket}
                disabled={savingGroup || !selectedRequestIds.length || !moveTargetGroupId}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Move to packet
              </button>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ResponsiveModal
        isOpen={Boolean(confirmAction)}
        onClose={() => !savingGroup && setConfirmAction(null)}
        title={confirmAction?.title || 'Confirm action'}
        size="sm"
        closeOnOverlayClick={!savingGroup}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{confirmAction?.message}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={savingGroup}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runConfirmAction}
              disabled={savingGroup}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                confirmAction?.kind === 'delete-packet'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {savingGroup ? 'Working...' : 'Confirm'}
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
};

export default MedicalReviewGroupPage;
