import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import AppleSidebar from './AppleSidebar';
import UnifiedClientManager from './UnifiedClientManager';
import HousesGrid from './HousesGrid';
import RetreatsGrid from './RetreatsGrid';
// import ScreeningClientsGrid from './ScreeningClientsGrid'; // Legacy, removed
// import ClientsGrid from './ClientsGrid'; // Now using UnifiedClientManager
import BookingsGrid from './BookingsGrid';
import MedicalGrid from './MedicalGrid';
import MedicalTrackingNew from './MedicalTrackingNew';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import RequirementsGrid from './RequirementsGrid';
import CurrencySettings from './CurrencySettings';
import MedicalAdvisorDashboard from './MedicalAdvisorDashboard';
import MedicalReviewDetail from './MedicalReviewDetail';
import MedicalRetreats from './MedicalRetreats';
import MedicalProfile from './MedicalProfile';
import { useAuth } from '../context/AuthContext';

const AppleLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isMedicalAdvisor = user?.role === 'medical_advisor';

  const getActiveItemFromPath = () => {
    const path = location.pathname;
    if (path.startsWith('/potential-clients') || path.startsWith('/clients')) return 'potential-clients';
    if (path.startsWith('/medical-dashboard')) return 'medical-dashboard';
    if (path.startsWith('/medical-review')) return 'medical-dashboard';
    if (path.startsWith('/medical-retreats')) return 'medical-retreats';
    if (path.startsWith('/medical-tracking')) return 'medical-tracking';
    if (path.startsWith('/retreats')) return 'retreats';
    if (path.startsWith('/houses')) return 'houses';
    if (path.startsWith('/bookings')) return 'bookings';
    if (path.startsWith('/medical')) return 'medical';
    if (path.startsWith('/reminders')) return 'reminders';
    if (path.startsWith('/payments')) return 'payments';
    if (path.startsWith('/requirements')) return 'requirements';
    if (path.startsWith('/analytics')) return 'analytics';
    return isMedicalAdvisor ? 'medical-dashboard' : 'potential-clients';
  };

  const activeItem = getActiveItemFromPath();

  useEffect(() => {
    if (location.pathname === '/') {
      if (isMedicalAdvisor) {
        navigate('/medical-dashboard', { replace: true });
      } else {
        navigate('/clients', { replace: true });
      }
    }
  }, [location.pathname, navigate, isMedicalAdvisor]);

  const handleItemClick = (item: string) => {
    navigate(`/${item}`);
    setSidebarOpen(false);
  };

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  // Listen for storage changes to sync sidebar state
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebarCollapsed');
      setSidebarCollapsed(saved === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('sidebarCollapsedChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarCollapsedChange', handleStorageChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-apple-gray-50">
      {/* Sidebar */}
      <AppleSidebar
        activeItem={activeItem}
        onItemClick={handleItemClick}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        userRole={user?.role}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Header with glass morphism */}
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-apple border-b border-apple-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-apple hover:bg-apple-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Title */}
              <h1 className="text-xl font-semibold text-apple-gray-900 tracking-tight">
                Provider Plus
              </h1>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Settings button */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-apple hover:bg-apple-gray-100 transition-colors"
                  aria-label="Settings"
                >
                  <svg className="w-5 h-5 text-apple-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* User menu */}
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-sm font-medium text-apple-gray-600 hover:text-apple-gray-900
                           bg-apple-gray-100 hover:bg-apple-gray-200 rounded-apple transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-apple-lg shadow-apple-sm" style={{ minHeight: 'calc(100vh - 120px)' }}>
              <Routes>
                {isMedicalAdvisor ? (
                  <>
                    <Route path="/medical-dashboard" element={<MedicalAdvisorDashboard />} />
                    <Route path="/medical-review/:bookingId" element={<MedicalReviewDetail />} />
                    <Route path="/medical-retreats" element={<MedicalRetreats />} />
                    <Route path="/medical/:clientId" element={<MedicalProfile />} />
                  </>
                ) : (
                  <>
                    <Route path="/potential-clients" element={<UnifiedClientManager />} />
                    <Route path="/clients" element={<UnifiedClientManager />} />
                    <Route path="/retreats" element={<RetreatsGrid />} />
                    <Route path="/houses" element={<HousesGrid />} />
                    {/* <Route path="/screening" element={<ScreeningClientsGrid />} --> Legacy, removed */}
                    <Route path="/bookings" element={<BookingsGrid />} />
                    <Route path="/medical" element={<MedicalGrid />} />
                    <Route path="/medical-tracking" element={<MedicalTrackingNew />} />
                    <Route path="/medical/:clientId" element={<MedicalProfile />} />
                    <Route path="/reminders" element={<RemindersPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/requirements" element={<RequirementsGrid />} />
                  </>
                )}
              </Routes>
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-white rounded-apple-xl shadow-apple-xl max-w-lg w-full">
            <CurrencySettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppleLayout;