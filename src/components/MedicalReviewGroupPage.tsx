import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheck, FiChevronDown, FiChevronRight, FiClock, FiCopy, FiEdit2, FiFileText, FiFolder, FiPlus, FiSliders, FiThumbsDown, FiThumbsUp, FiTrash2 } from 'react-icons/fi';
import { Activity, Droplets, FileText } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ResponsiveModal from './ResponsiveModal';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewGroup, MedicalReviewRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { buildPacketSections, getClientName, getRequestKey, getRetreatLabel, isPendingReview } from './MedicalReviewGroupPage.helpers';
import { isPendingMedicalReviewStatus, medicalReviewStatusPresentation, medicalReviewStatuses, normalizeMedicalReviewStatus } from './medicalReviewStatus';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const statusIconByName: Record<string, any> = {
  clock: FiClock,
  'thumbs-up': FiThumbsUp,
  'thumbs-down': FiThumbsDown,
  alert: FiAlertTriangle,
  check: FiCheck,
};

const statusClass = Object.fromEntries(
  Object.entries(medicalReviewStatusPresentation).map(([status, presentation]) => [status, presentation.badgeClass]),
);
const statusIcon = Object.fromEntries(
  Object.entries(medicalReviewStatusPresentation).map(([status, presentation]) => [status, statusIconByName[presentation.icon] || FiClock]),
);
const statusRowClass = Object.fromEntries(
  Object.entries(medicalReviewStatusPresentation).map(([status, presentation]) => [status, presentation.rowClass]),
);

const statusFilterLabels: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In review',
  caution: 'Caution',
  needs_resubmission: 'Needs resubmission',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

const DEFAULT_STATUS_FILTER = new Set<string>(medicalReviewStatuses.filter((status) => isPendingMedicalReviewStatus(status)));

const mobileTypeTileConfig: Record<string, { Icon: any; tileClass: string; iconClass: string; label: string }> = {
  ekg: { Icon: Activity, tileClass: 'bg-green-100', iconClass: 'text-green-600', label: 'EKG' },
  ekg_review: { Icon: Activity, tileClass: 'bg-green-100', iconClass: 'text-green-600', label: 'EKG' },
  ceremony_ekg_review: { Icon: Activity, tileClass: 'bg-green-100', iconClass: 'text-green-600', label: 'EKG' },
  liver: { Icon: Droplets, tileClass: 'bg-red-100', iconClass: 'text-red-600', label: 'Liver panel tests' },
  liver_panel: { Icon: Droplets, tileClass: 'bg-red-100', iconClass: 'text-red-600', label: 'Liver panel tests' },
  liver_panel_review: { Icon: Droplets, tileClass: 'bg-red-100', iconClass: 'text-red-600', label: 'Liver panel tests' },
  bp: { Icon: Activity, tileClass: 'bg-blue-100', iconClass: 'text-blue-600', label: 'Blood pressure' },
  blood_pressure: { Icon: Activity, tileClass: 'bg-blue-100', iconClass: 'text-blue-600', label: 'Blood pressure' },
  blood_pressure_review: { Icon: Activity, tileClass: 'bg-blue-100', iconClass: 'text-blue-600', label: 'Blood pressure' },
  additional: { Icon: FileText, tileClass: 'bg-amber-100', iconClass: 'text-amber-700', label: 'Additional' },
  medications_review: { Icon: FileText, tileClass: 'bg-amber-100', iconClass: 'text-amber-700', label: 'Medications' },
};
const getMobileTypeTile = (requestType?: string) => mobileTypeTileConfig[String(requestType || '').toLowerCase()] || {
  Icon: FileText,
  tileClass: 'bg-gray-100',
  iconClass: 'text-gray-600',
  label: requestType ? String(requestType).replace(/_/g, ' ') : 'Review',
};

const getShortClientName = (request: MedicalReviewRequest) => {
  const client = request.clientId && typeof request.clientId === 'object' ? (request.clientId as any) : {};
  const firstName = client.firstName || '';
  const lastInitial = client.lastName ? `${String(client.lastName).charAt(0)}.` : '';
  return [firstName, lastInitial].filter(Boolean).join(' ') || getClientName(request);
};

const getGroupUserId = (value?: string | { _id?: string; id?: string } | null) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

type ConfirmAction =
  | { kind: 'remove-request'; requestId: string; title: string; message: string }
  | { kind: 'delete-packet'; title: string; message: string };

const MedicalReviewGroupPage: React.FC = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/medical') ? '/medical/review-requests' : '/admin/medical-review-requests';
  const [group, setGroup] = useState<MedicalReviewGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [allRequests, setAllRequests] = useState<MedicalReviewRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<MedicalReviewGroup[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [packetEditMode, setPacketEditMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(DEFAULT_STATUS_FILTER));
  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(() => new Set(DEFAULT_STATUS_FILTER));
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const canManageGroup = user?.role === 'admin' || user?.role === 'medical_staff';
  const openRequestFromPocket = (requestId?: string) => {
    if (!requestId) return;
    sessionStorage.setItem('medicalReviewReturnPath', location.pathname);
    navigate(`/medical/review-requests/${requestId}`, { state: { returnTo: location.pathname } });
  };

  const loadGroup = useCallback(async () => {
    const groupResponse = await medicalReviewRequestsApi.getGroup(id);
    setGroup(groupResponse.data);
    const currentRequests = (groupResponse.data?.requests || []) as MedicalReviewRequest[];
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

  const removeRequestFromGroup = async (requestId: string) => {
    if (!group?._id || !requestId) return;
    setConfirmAction({
      kind: 'remove-request',
      requestId,
      title: 'Remove MRR from packet?',
      message: 'The review request will stay in the system. Only the packet link will be updated.',
    });
  };

  const copyPacketLink = async () => {
    if (!group?._id) return;
    const url = `${window.location.origin}/medical/review-groups/${group._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy packet link', url);
    }
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
      if (confirmAction.kind === 'remove-request' && group?._id) {
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

  const allGroupRequests = (group?.requests || []) as MedicalReviewRequest[];
  const filteredGroupRequests = useMemo(
    () => allGroupRequests.filter((request) => statusFilter.has(normalizeMedicalReviewStatus(request.status))),
    [allGroupRequests, statusFilter],
  );
  const sections = useMemo(
    () => buildPacketSections(group, filteredGroupRequests),
    [group, filteredGroupRequests],
  );
  const orderedRequestNumbers = useMemo(() => {
    const map = new Map<string, number>();
    sections.flatMap((section) => section.requests).forEach((request, index) => {
      map.set(getRequestKey(request), index + 1);
    });
    return map;
  }, [sections]);
  const pendingRequestCount = allGroupRequests.filter(isPendingReview).length;
  const isDefaultStatusFilter = statusFilter.size === DEFAULT_STATUS_FILTER.size
    && Array.from(statusFilter).every((status) => DEFAULT_STATUS_FILTER.has(status));

  const openFilterModal = () => {
    setDraftStatusFilter(new Set(statusFilter));
    setFilterModalOpen(true);
  };
  const toggleDraftStatus = (status: string) => {
    setDraftStatusFilter((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };
  const applyStatusFilter = () => {
    setStatusFilter(new Set(draftStatusFilter.size ? draftStatusFilter : DEFAULT_STATUS_FILTER));
    setFilterModalOpen(false);
  };
  const resetStatusFilterToPending = () => {
    setDraftStatusFilter(new Set(DEFAULT_STATUS_FILTER));
  };
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
        <div className="bg-[#f7f4ee] px-6 pb-6 pt-6 md:hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">{group?.retreatName || 'Grouped medical review packet'}</div>
              <h1 className="mt-1 text-[26px] font-black leading-none tracking-tight text-gray-900">{group?.title || 'Medical review packet'}</h1>
              <p className="mt-3 max-w-[280px] text-[13px] font-semibold leading-snug text-red-700">{pendingRequestCount} request{pendingRequestCount === 1 ? '' : 's'} awaiting review</p>
            </div>
            <button
              type="button"
              onClick={openFilterModal}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isDefaultStatusFilter ? 'bg-red-100 text-red-700' : 'bg-red-600 text-white'}`}
              aria-label="Filter requests"
              title="Filter requests"
            >
              <Icon icon={FiSliders} className="h-5 w-5" />
            </button>
          </div>
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
                      onClick={copyPacketLink}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      aria-label="Copy packet link"
                      title="Copy packet link"
                    >
                      <Icon icon={FiCopy} className="h-4 w-4" />
                    </button>
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
              {canManageGroup && packetEditMode && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openMoveModal}
                    disabled={!selectedRequestIds.length}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Icon icon={FiFolder} className="h-4 w-4" />
                    Move selected
                  </button>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">{group?.groupType || 'custom'} packet</div>
            </div>
          </div>
        </div>

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
                      <div className={`truncate text-sm font-semibold text-gray-900 ${section.title === group?.title ? 'md:block hidden' : ''}`}>{section.title}</div>
                      <div className="text-xs text-gray-500">{section.subtitle}</div>
                    </div>
                  </div>
                  <Icon icon={expanded ? FiChevronDown : FiChevronRight} className="h-5 w-5 shrink-0 text-gray-500" />
                </button>
                {expanded && (
                  <div className="divide-y divide-gray-100">
                    {section.requests.map((request) => {
                      const tile = getMobileTypeTile(request.requestType);
                      const rowNumber = orderedRequestNumbers.get(getRequestKey(request));
                      return (
                      <React.Fragment key={request._id}>
                        <button
                          type="button"
                          onClick={() => openRequestFromPocket(request._id)}
                          className="flex w-full items-center gap-3 border-b border-gray-100 bg-white px-4 py-4 text-left last:border-b-0 md:hidden"
                        >
                          <span className="w-5 shrink-0 text-sm font-semibold text-gray-400">{rowNumber}</span>
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tile.tileClass}`}>
                            <Icon icon={tile.Icon} className={`h-5 w-5 ${tile.iconClass}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-bold text-gray-900">{tile.label}</span>
                            <span className="block truncate text-sm text-gray-500">{getShortClientName(request)}</span>
                          </span>
                          <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                            {String(request.status || 'unknown').replace(/_/g, ' ')}
                          </span>
                          <Icon icon={FiChevronRight} className="h-5 w-5 shrink-0 text-gray-300" />
                        </button>

                        <div
                          className={`hidden md:grid md:items-center md:gap-x-3 md:border-b md:border-gray-100 md:py-4 ${statusRowClass[request.status] || 'bg-white'} ${canManageGroup ? 'md:grid-cols-[36px_150px_minmax(0,1fr)_220px_150px_130px]' : 'md:grid-cols-[150px_minmax(0,1fr)_220px_150px_130px]'}`}
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
                            onClick={() => openRequestFromPocket(request._id)}
                            className="text-left text-sm font-bold text-cyan-800 hover:underline"
                          >
                            #{request.display_id || '-'}
                          </button>
                          <div className="mt-1 text-xs text-gray-700">{request.requestType || 'review'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{getClientName(request)}</div>
                          <div className="truncate text-xs text-gray-500">{getRetreatLabel(request)}</div>
                        </div>
                        <div className="min-w-0">
                          <MedicalReviewTypeBadge requestType={request.requestType} />
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                            <Icon icon={statusIcon[request.status] || FiClock} className="h-3.5 w-3.5" />
                            {String(request.status || 'unknown').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                            onClick={() => openRequestFromPocket(request._id)}
                              className="rounded-md bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800"
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
                      </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
              {isDefaultStatusFilter
                ? 'No pending reviews in this packet.'
                : 'No requests match the current filter.'}
            </div>
          )}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-gray-900 bg-white px-6 py-4 text-[11px] md:hidden">
          <span className="text-gray-600">Pending reviews shown first</span>
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
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter requests"
        size="sm"
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetStatusFilterToPending}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Reset to pending only
            </button>
            <button
              type="button"
              onClick={applyStatusFilter}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Choose which statuses to show. By default only pending requests are shown.</p>
          {medicalReviewStatuses.map((status) => (
            <label key={status} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2.5 text-sm hover:bg-gray-50">
              <span className="flex items-center gap-2 font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={draftStatusFilter.has(status)}
                  onChange={() => toggleDraftStatus(status)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                {statusFilterLabels[status] || status}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[status] || 'bg-gray-100 text-gray-700'}`}>
                {statusFilterLabels[status] || status}
              </span>
            </label>
          ))}
        </div>
      </ResponsiveModal>

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
