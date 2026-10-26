import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { medicalReviewRequestsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';

export default function MrrWhatsappDownloadButton({ requestId, requestNumber, onError, className = 'rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100' }: {
  requestId: string;
  requestNumber?: number | string | null;
  onError: (message: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [preparing, setPreparing] = useState(false);
  if (!requestId || !['admin', 'medical_staff'].includes(user?.role || '')) return null;
  const download = async () => {
    if (preparing) return;
    setPreparing(true);
    try {
      const { data } = await medicalReviewRequestsApi.downloadForWhatsapp(requestId);
      window.location.assign(data.url);
    } catch (error) {
      onError(apiErrorMessage(error, 'Unable to download this MRR. Please try again.'));
    } finally {
      setPreparing(false);
    }
  };
  return <button type="button" onClick={() => void download()} disabled={preparing} className={className}
    aria-label={`Download MRR ${requestNumber ? `#${requestNumber}` : 'request'} for WhatsApp`}>
    {preparing ? 'Preparing…' : 'Download for WhatsApp'}
  </button>;
}
