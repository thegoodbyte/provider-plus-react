import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiRefreshCw } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi, medicalTrackingApi, clientsApi, retreatsApi } from '../services/api';
import { MedicalItem, MedicalReviewRequest, Client, Retreat } from '../types';
import { useAuth } from '../context/AuthContext';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

interface EnrichedReviewRequest extends MedicalReviewRequest {
  clientName?: string;
  retreatName?: string;
  trackingFileName?: string;
}

const getRetreatCode = (retreat?: Retreat) => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

const getAssignee = (request: MedicalReviewRequest) => {
  const assignedUser = typeof request.assignedToUserId === 'object' && request.assignedToUserId
    ? request.assignedToUserId
    : null;
  const name = assignedUser
    ? [assignedUser.firstName, assignedUser.lastName].filter(Boolean).join(' ') || assignedUser.email
    : request.assignedTo || request.medicalReviewerName || '';
  const email = assignedUser?.email || request.assignedToEmail || '';

  return {
    name: name || 'Unassigned',
    email,
  };
};

const statusClass: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const MedicalReviewRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/medical') ? '/medical/review-requests' : '/admin/medical-review-requests';
  const canManageRequests = user?.role === 'admin' || user?.role === 'medical_staff';
  const [requests, setRequests] = useState<EnrichedReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | MedicalReviewRequest['status']>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [requestsResponse, trackingResponse, clientsResponse, retreatsResponse] = await Promise.all([
        medicalReviewRequestsApi.getAll(),
        medicalTrackingApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
      ]);

      const trackingMapValue = (trackingResponse.data || []).reduce((acc: Record<string, MedicalItem>, item: MedicalItem) => {
        if (item._id) acc[item._id] = item;
        return acc;
      }, {});

      const clientMapValue = (clientsResponse.data || []).reduce((acc: Record<string, Client>, client: Client) => {
        if (client._id) acc[client._id] = client;
        return acc;
      }, {});

      const retreatMapValue = (retreatsResponse.data || []).reduce((acc: Record<string, Retreat>, retreat: Retreat) => {
        if (retreat._id) acc[retreat._id] = retreat;
        return acc;
      }, {});

      const enriched = (requestsResponse.data || []).map((request: MedicalReviewRequest) => {
        const clientId = typeof request.clientId === 'string' ? request.clientId : request.clientId?._id;
        const retreatId = typeof request.retreatId === 'string' ? request.retreatId : request.retreatId?._id;
        const trackingId = typeof request.medicalTrackingId === 'string' ? request.medicalTrackingId : request.medicalTrackingId?._id;
        const client = clientId ? clientMapValue[clientId] : undefined;
        const retreat = retreatId ? retreatMapValue[retreatId] : undefined;
        const tracking = trackingId ? trackingMapValue[trackingId] : undefined;
        return {
          ...request,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          retreatName: getRetreatCode(retreat),
          trackingFileName: tracking?.ekgFileName || tracking?.liverPanelFileName || undefined,
        };
      });

      setRequests(enriched);
    } catch (error) {
      console.error('Error loading medical review requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRequests = useMemo(() => {
    if (filterStatus === 'all') return requests;
    return requests.filter((request) => request.status === filterStatus);
  }, [requests, filterStatus]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review request?')) return;
    await medicalReviewRequestsApi.delete(id);
    await loadData();
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review requests..." />;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Medical Review Requests</h1>
          <p className="text-sm text-gray-600">Queue and audit trail for EKG and liver panel review rounds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon={FiRefreshCw} className="h-4 w-4" />
            Refresh
          </button>
          {canManageRequests && (
            <button
              onClick={() => navigate(`${basePath}/new`)}
              className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Icon icon={FiPlus} className="h-4 w-4" />
              Add New Request
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-end gap-2">
        <label htmlFor="review-status-filter" className="text-sm font-medium text-gray-700">Status</label>
        <select
          id="review-status-filter"
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
          className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Request #</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Retreat</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Attempt</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assignee</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">#{request.display_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {request.clientName}
                    <div className="text-xs text-gray-500">#{request.clientDisplayId || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.retreatName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.requestType}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.attemptNumber || 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{getAssignee(request).name}</div>
                    {getAssignee(request).email && <div className="text-xs text-gray-500">{getAssignee(request).email}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.source || 'Provider Plus CRM'}</td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`${basePath}/${request._id}`)}
                        className="icon-action-btn icon-action-btn-view"
                        title="View"
                      >
                        <Icon icon={FiEye} />
                      </button>
                      {canManageRequests && (
                        <button
                          onClick={() => navigate(`${basePath}/${request._id}/edit`)}
                          className="icon-action-btn icon-action-btn-edit"
                          title="Edit"
                        >
                          <Icon icon={FiEdit2} />
                        </button>
                      )}
                      {canManageRequests && (
                        <button
                          onClick={() => handleDelete(request._id!)}
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete"
                        >
                          <Icon icon={FiTrash2} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewRequestsGrid;
