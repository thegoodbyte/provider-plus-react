import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import AppleLayout from './components/AppleLayout';
import { Login } from './components/Login/Login';
import { ForgotPassword } from './components/Login/ForgotPassword';
import { ResetPassword } from './components/Login/ResetPassword';
import MedicalReviewAccessPage from './components/MedicalReviewAccessPage';
import MedicalReviewGroupAccessPage from './components/MedicalReviewGroupAccessPage';
import MedicalReviewPublicPage from './components/MedicalReviewPublicPage';
import ContractRedirectPage from './components/ContractRedirectPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { preloaderService } from './services/preloader';
import ApiErrorHandler from './components/ApiErrorHandler';
import DebugOverlay from './components/DebugOverlay';
import { installNativeDialogReplacement } from './utils/nativeDialogReplacement';
import './App.css';
import './styles/apple.css';
import './styles/animations.css';

installNativeDialogReplacement();

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isPublicMedicalReviewRoute = location.pathname.startsWith('/medical-review-access/')
    || location.pathname.startsWith('/medical-review-group-access/')
    || location.pathname.startsWith('/medical/review-link/')
    || location.pathname.startsWith('/clients/contracts/jotform/link/');
  const isPublicPasswordRoute = location.pathname === '/users/forgot-password'
    || location.pathname === '/users/forgot-pasword'
    || location.pathname.startsWith('/users/change-password/');

  // Preload essential data when user is authenticated (non-blocking)
  useEffect(() => {
    if (isAuthenticated) {
      // In development, disable preloading for faster page loads
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Preloading disabled in development for faster loading');
        return;
      }
      // Start preloading in background without blocking UI
      preloaderService.preloadEssentialData().catch(console.error);
    }
  }, [isAuthenticated]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Medical access links must exchange their token outside the authenticated layout.
  // Otherwise a previously selected admin app mode can redirect and unmount the exchange page.
  if (isPublicMedicalReviewRoute || (!isAuthenticated && isPublicPasswordRoute)) {
    return (
      <Routes>
        <Route path="/medical-review-access/:token/:label" element={<MedicalReviewAccessPage />} />
        <Route path="/medical-review-access/:token" element={<MedicalReviewAccessPage />} />
        <Route path="/medical-review-group-access/:token" element={<MedicalReviewGroupAccessPage />} />
        <Route path="/medical/review-link/:token" element={<MedicalReviewPublicPage />} />
        <Route path="/clients/contracts/jotform/link/:bookingId" element={<ContractRedirectPage />} />
        <Route path="/users/forgot-password" element={<ForgotPassword />} />
        <Route path="/users/forgot-pasword" element={<ForgotPassword />} />
        <Route path="/users/change-password/:token" element={<ResetPassword />} />
      </Routes>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <AppleLayout />
      <DebugOverlay />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ApiErrorHandler>
            <AppContent />
          </ApiErrorHandler>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
