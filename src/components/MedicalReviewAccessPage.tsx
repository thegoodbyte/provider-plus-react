import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { medicalReviewRequestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MedicalReviewAccessPage: React.FC = () => {
  const { token = '', label = '' } = useParams();
  const navigate = useNavigate();
  const { storeSession } = useAuth();
  const [error, setError] = useState<{ message: string; status?: number }>({ message: '' });
  const decodedToken = useMemo(() => decodeURIComponent(token), [token]);

  useEffect(() => {
    let active = true;

    const exchange = async () => {
      if (!decodedToken) {
        setError({ message: 'This medical review link is missing its access token.' });
        return;
      }

      try {
        const response = await medicalReviewRequestsApi.exchangeAccessLink(decodedToken);
        if (!active) return;
        storeSession({
          access_token: response.data.access_token,
          user: response.data.user,
        });
        navigate(response.data.redirectTo || `/medical/review-requests/${response.data.reviewRequestId}/edit`, { replace: true });
      } catch (requestError: any) {
        if (!active) return;
        setError({
          message: requestError?.response?.data?.message || requestError?.message || 'This medical review access link is invalid or expired.',
          status: requestError?.response?.status,
        });
      }
    };

    exchange();

    return () => {
      active = false;
    };
  }, [decodedToken, navigate, storeSession]);

  if (error.message) {
    const reviewLabel = label ? label.replace(/[-_]/g, ' ') : '';
    const isAccessProblem = error.status === 401 || error.status === 403 || error.status === 404;

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-700">!</div>
          <div className="mt-4 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Medical review link cannot be opened</h1>
            <p className="mt-2 text-sm text-gray-600">
              This is a private medical review link. Normal Provider Plus login will not open it unless a valid access link is issued for you.
            </p>
          </div>

          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-semibold">Access check failed</div>
            <div className="mt-1">{error.message}</div>
          </div>

          <div className="mt-5 space-y-3 text-left text-sm text-gray-700">
            {reviewLabel && (
              <div>
                <span className="font-semibold text-gray-900">Review type:</span> {reviewLabel}
              </div>
            )}
            <div>
              <span className="font-semibold text-gray-900">What this usually means:</span>{' '}
              {isAccessProblem
                ? 'the link was revoked, copied incorrectly, generated for another environment, or no longer exists.'
                : 'the server could not validate the access link right now.'}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Next step:</span> ask the Provider Plus admin to generate a new medical quick access link for this review.
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <LoadingSpinner message="Opening medical review..." />;
};

export default MedicalReviewAccessPage;
