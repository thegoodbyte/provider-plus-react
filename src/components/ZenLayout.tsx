import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import ZenSidebar from './ZenSidebar';
import RetreatsGrid from './RetreatsGrid';
import HousesGrid from './HousesGrid';
// import ScreeningClientsGrid from './ScreeningClientsGrid';
import UnifiedClientManager from './UnifiedClientManager';
import BookingsGrid from './BookingsGrid';
import MedicalGrid from './MedicalGrid';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import RequirementsGrid from './RequirementsGrid';
import CurrencySettings from './CurrencySettings';
import MedicalAdvisorDashboard from './MedicalAdvisorDashboard';
import MedicalReviewDetail from './MedicalReviewDetail';
import MedicalRetreats from './MedicalRetreats';
import MedicalProfile from './MedicalProfile';
import { useAuth } from '../context/AuthContext';
import { Menu, Settings, X } from 'lucide-react';

const ZenLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isMedicalAdvisor = user?.role === 'medical_advisor';

  const getActiveItemFromPath = () => {
    const path = location.pathname;
    if (path.startsWith('/medical-dashboard')) return 'medical-dashboard';
    if (path.startsWith('/medical-review')) return 'medical-dashboard';
    if (path.startsWith('/medical-retreats')) return 'medical-retreats';
    if (path.startsWith('/houses')) return 'houses';
    if (path.startsWith('/screening')) return 'screening';
    if (path.startsWith('/clients')) return 'clients';
    if (path.startsWith('/bookings')) return 'bookings';
    if (path.startsWith('/medical')) return 'medical';
    if (path.startsWith('/reminders')) return 'reminders';
    if (path.startsWith('/payments')) return 'payments';
    if (path.startsWith('/requirements')) return 'requirements';
    if (path.startsWith('/analytics')) return 'analytics';
    return isMedicalAdvisor ? 'medical-dashboard' : 'clients';
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

  return (
    <div className="min-h-screen bg-zen-50">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 rounded-soft bg-white shadow-sm hover:shadow-md transition-shadow"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? (
          <X className="w-5 h-5 text-zen-600" />
        ) : (
          <Menu className="w-5 h-5 text-zen-600" />
        )}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-zen-900/20 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <ZenSidebar
        activeItem={activeItem}
        onItemClick={handleItemClick}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        userRole={user?.role}
      />

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Minimal Header */}
        <header className="bg-white border-b border-zen-100">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-light text-zen-800 tracking-wide">
                Provider Plus
              </h1>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-soft hover:bg-zen-50 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-zen-500" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
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
                  <Route path="/houses" element={<HousesGrid />} />
                  {/* <Route path="/screening" element={<ScreeningClientsGrid />} /> */}
                  <Route path="/clients" element={<UnifiedClientManager />} />
                  <Route path="/bookings" element={<BookingsGrid />} />
                  <Route path="/medical" element={<MedicalGrid />} />
                  <Route path="/medical/:clientId" element={<MedicalProfile />} />
                  <Route path="/reminders" element={<RemindersPage />} />
                  <Route path="/payments" element={<PaymentsPage />} />
                  <Route path="/requirements" element={<RequirementsGrid />} />
                </>
              )}
            </Routes>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <CurrencySettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};

export default ZenLayout;