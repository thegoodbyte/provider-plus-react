import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';

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

const MedicalReviewGroupPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    medicalReviewRequestsApi.getGroup(id)
      .then((response) => {
        if (mounted) setGroup(response.data);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError?.response?.data?.message || 'Unable to load grouped review.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <LoadingSpinner message="Loading grouped review..." />;
  if (error) return <div className="p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Grouped Medical Review</div>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{group?.title || 'Medical review packet'}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {group?.retreatName || 'No retreat'} {group?.ceremonyNumber ? `• Ceremony #${group.ceremonyNumber}` : ''} • {group?.requestCount || group?.requests?.length || 0} requests
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(group?.requests || []).map((request: any) => (
              <tr key={request._id}>
                <td className="px-4 py-3 font-semibold text-blue-700">#{request.display_id || '-'}</td>
                <td className="px-4 py-3">{getClientName(request)}</td>
                <td className="px-4 py-3">{request.requestType}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/medical/review-requests/${request._id}/edit`)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Open review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicalReviewGroupPage;
