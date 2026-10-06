import React, { createContext, useContext, useState } from 'react';
import { medicalReviewRequestsApi } from '../services/api';
export const MedicalReviewDownloadContext = createContext('');
export default function MedicalReviewFileDownload({ artifactId, fileKey }: { artifactId?: string; fileKey: string }) {
  const reviewId = useContext(MedicalReviewDownloadContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!reviewId || !artifactId || !fileKey) return null;
  const download = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await medicalReviewRequestsApi.downloadArtifact(reviewId, artifactId, fileKey);
      const anchor = document.createElement('a');
      anchor.href = data.url;
      anchor.download = data.fileName;
      anchor.rel = 'noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch { setError('Unable to download document. Please try again.'); }
    finally { setLoading(false); }
  };
  return <span className="no-print inline-flex flex-wrap items-center gap-2"><button type="button" disabled={loading} onClick={download} className="min-h-9 font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50">{loading ? 'Preparing…' : 'Download'}</button>{error && <span role="alert" className="text-red-700">{error}</span>}</span>;
}
