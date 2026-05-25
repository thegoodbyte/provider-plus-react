import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import LoadingSpinner from './LoadingSpinner';

const MedicalReviewPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<MedicalReviewRequest | null>(null);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await medicalReviewRequestsApi.getPublic(token);
        setRequest(response.data.request);
        setArtifacts(response.data.artifacts || []);
      } catch (err) {
        console.error('Error loading public medical review request:', err);
        setError('This medical review link is invalid or expired.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) return <LoadingSpinner message="Loading medical review request..." />;

  if (error || !request) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-red-700">{error || 'Request not found.'}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Medical Review Request #{request.display_id || '—'}</h1>
        <div className="mt-1 text-sm text-gray-600">
          {typeof request.clientId === 'string' ? 'Client record' : `${request.clientId?.firstName || ''} ${request.clientId?.lastName || ''}`.trim()}
        </div>
      </div>

      <div className="space-y-4">
        {artifacts.length === 0 ? (
          <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-500">No linked medical records are available for this request.</div>
        ) : (
          artifacts.map((artifact) => (
            <div key={artifact._id} className="rounded-md border border-gray-200 p-4">
              <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {artifact.title}</div>
              <div className="mt-1 text-sm capitalize text-gray-600">{artifact.artifactType?.replace(/_/g, ' ')}</div>
              {artifact.textContent && <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{artifact.textContent}</div>}
              {artifact.notes && <div className="mt-3 text-sm text-gray-600">Notes: {artifact.notes}</div>}
              {!!artifact.files?.length && (
                <div className="mt-4 space-y-2">
                  {artifact.files.map((file: any, index) => (
                    <a
                      key={`${file.fileName || file.url}-${index}`}
                      href={file.url || file.filePath || file.s3Key}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      {file.fileName || `File ${index + 1}`}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MedicalReviewPublicPage;
