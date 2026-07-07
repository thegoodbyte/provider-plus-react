import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiCopy, FiLink, FiRefreshCw } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';

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

const MedicalReviewGroupPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingLink, setIssuingLink] = useState(false);
  const [error, setError] = useState('');

  const loadGroup = useCallback(async () => {
    const [groupResponse, linksResponse] = await Promise.all([
      medicalReviewRequestsApi.getGroup(id),
      medicalReviewRequestsApi.getGroupAccessLinks(id),
    ]);
    setGroup(groupResponse.data);
    setAccessLinks(linksResponse.data || []);
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {group?.url && (
            <button
              type="button"
              onClick={() => copyToClipboard(group.url)}
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
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Issued links</h2>
            <p className="text-xs text-gray-500">Permanent group link plus any additional links issued later.</p>
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
                <td className="px-4 py-3">
                  <MedicalReviewTypeBadge requestType={request.requestType} />
                </td>
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
