import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewRequest } from '../types';
import { indexMedicalReviews } from './bookingMedicalOverviewData';

export function useArtifactReviews(ids: Array<string | undefined>, refreshKey: unknown = 0) {
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  const [state, setState] = useState<{ key: string; reviews: Record<string, MedicalReviewRequest[]>; error: boolean; loading: boolean }>({ key: '', reviews: {}, error: false, loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ key, reviews: {}, error: false, loading: true });
    const load = Promise.resolve().then(() => key ? medicalReviewRequestsApi.getByArtifacts(key.split(',')) : { data: [] });
    load.then(response => { if (active) setState({ key, reviews: indexMedicalReviews(response.data || []), error: false, loading: false }); })
      .catch(() => { if (active) setState({ key, reviews: {}, error: true, loading: false }); });
    return () => { active = false; };
  }, [key, refreshKey, retry]);
  return { ...state, loading: state.key !== key || state.loading, retry: () => setRetry(x => x + 1) };
}

export default function ArtifactReviewStatus({ artifactId, state }: { artifactId?: string; state: ReturnType<typeof useArtifactReviews> }) {
  const location = useLocation();
  const section = location.pathname.split('/').filter(Boolean)[0];
  const prefix = ['admin', 'medical', 'staff', 'user'].includes(section) ? `/${section}` : '/admin';
  if (!artifactId) return null;
  if (state.loading) return <p className="text-sm" role="status">Loading MRR status…</p>;
  if (state.error) return <p role="alert" className="text-sm text-red-700">Unable to load MRR status. <button type="button" onClick={state.retry}>Retry MRR lookup</button></p>;
  const reviews = state.reviews[artifactId] || [];
  return <div className="my-2 text-sm" aria-label="Medical review requests">
    {reviews.length ? reviews.map(review => <div key={review._id}>
      <Link className="text-blue-700 underline" to={`${prefix}/medical-review-requests/${review._id}`}>MRR #{review.display_id || review._id}</Link>
      {' · '}{(review.status || 'Unknown status').replace(/_/g, ' ')}
      {(review.reviewDecision || review.decision) && <> · {String(review.reviewDecision || review.decision).replace(/_/g, ' ')}</>}
    </div>) : <><strong>MRR missing</strong>{' · '}<Link className="text-blue-700 underline" to={`${prefix}/medical-review-requests/new?artifactId=${encodeURIComponent(artifactId)}`}>Create MRR</Link></>}
  </div>;
}
