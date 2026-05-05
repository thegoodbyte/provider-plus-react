import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppleButton from './AppleButton';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getHomeRouteForRole = (role: string): string => {
    switch (role) {
      case 'admin':
        return '/admin/clients';
      case 'medical_staff':
        return '/medical/medical-dashboard';
      case 'facilitator':
        return '/staff/bookings';
      case 'user':
        return '/user/clients';
      default:
        return '/';
    }
  };

  const handleGoHome = () => {
    const homeRoute = getHomeRouteForRole(user?.role || 'user');
    navigate(homeRoute);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-apple-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Error Icon */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>

          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Your current role is{' '}
            <span className="font-semibold text-gray-900">
              {user?.role?.replace('_', ' ') || 'Unknown'}
            </span>
            .
          </p>
        </div>

        {/* Role Information */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Your Access Level</h2>
          <div className="text-sm text-gray-600">
            {user?.role === 'admin' && (
              <p>As an Administrator, you have full system access. If you're seeing this page, there might be a configuration issue.</p>
            )}
            {user?.role === 'medical_staff' && (
              <p>As Medical Staff, you have access to medical tracking, client profiles, and medical-related features.</p>
            )}
            {user?.role === 'facilitator' && (
              <p>As a Facilitator, you have access to bookings, retreats, houses, and operational features.</p>
            )}
            {user?.role === 'user' && (
              <p>As a User, you have basic access to client information and reminders.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <AppleButton
            onClick={handleGoHome}
            className="w-full justify-center"
          >
            Go to Your Dashboard
          </AppleButton>

          <AppleButton
            onClick={handleGoBack}
            variant="secondary"
            className="w-full justify-center"
          >
            Go Back
          </AppleButton>
        </div>

        {/* Contact Information */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>
            Need access to additional features?{' '}
            <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
              Contact your administrator
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;