import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';
import { authService } from '../services/authService';

const MedicalReviewAccessPage: React.FC = () => {
  const { token = '', label = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const decodedToken = useMemo(() => decodeURIComponent(token), [token]);

  useEffect(() => {
    let active = true;

    const exchange = async () => {
      if (!decodedToken) {
        setError('Missing medical review access token.');
        return;
      }

      try {
        const response = await medicalReviewRequestsApi.exchangeAccessLink(decodedToken);
        if (!active) return;
        authService.storeSession({
          access_token: response.data.access_token,
          user: response.data.user,
        });
        window.location.href = response.data.redirectTo || `/medical/review-requests/${response.data.reviewRequestId}/edit`;
      } catch (requestError: any) {
        if (!active) return;
        setError(requestError?.response?.data?.message || requestError?.message || 'This medical review access link is invalid or expired.');
      }
    };

    exchange();

    return () => {
      active = false;
    };
  }, [decodedToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Medical review access</h1>
        <p className="mt-2 text-sm text-gray-600">{label ? `Review type: ${label}` : 'Review link'}</p>
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Go to login
        </button>
      </div>
    );
  }

  return <LoadingSpinner message="Opening medical review..." />;
};

export default MedicalReviewAccessPage;
