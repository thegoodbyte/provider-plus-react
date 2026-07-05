import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MedicalReviewGroupAccessPage: React.FC = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { storeSession } = useAuth();
  const [error, setError] = useState('');
  const decodedToken = useMemo(() => decodeURIComponent(token), [token]);

  useEffect(() => {
    let active = true;
    const exchange = async () => {
      if (!decodedToken) {
        setError('This grouped review link is missing its access token.');
        return;
      }
      try {
        const response = await medicalReviewRequestsApi.exchangeGroupAccessLink(decodedToken);
        if (!active) return;
        storeSession({ access_token: response.data.access_token, user: response.data.user });
        navigate(response.data.redirectTo || `/medical/review-groups/${response.data.reviewGroupId}`, { replace: true });
      } catch (requestError: any) {
        if (!active) return;
        setError(requestError?.response?.data?.message || requestError?.message || 'This grouped medical review link is invalid or expired.');
      }
    };
    exchange();
    return () => {
      active = false;
    };
  }, [decodedToken, navigate, storeSession]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Grouped review link cannot be opened</h1>
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  return <LoadingSpinner message="Opening grouped medical review..." />;
};

export default MedicalReviewGroupAccessPage;
