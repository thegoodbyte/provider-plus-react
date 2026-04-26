import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppleLayout from './components/AppleLayout';
import { Login } from './components/Login/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { preloaderService } from './services/preloader';
import './App.css';
import './styles/apple.css';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

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

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AppleLayout />;
}

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;