import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
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
import './Layout.css';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCurrencySettings, setShowCurrencySettings] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if user is medical advisor
  const isMedicalAdvisor = user?.role === 'medical_advisor';

  // Get active item from current path
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
    return isMedicalAdvisor ? 'medical-dashboard' : 'clients'; // default based on role
  };

  const activeItem = getActiveItemFromPath();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Redirect based on role if on root path
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
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };


  // Keep the same layout for medical advisors, just show limited content

  return (
    <div className="layout">
      <Sidebar
        activeItem={activeItem}
        onItemClick={handleItemClick}
        isCollapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        onLogout={logout}
        userRole={user?.role}
      />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="app-header">
          <h1>Provider Plus</h1>
          <div className="header-actions">
            <button
              onClick={() => setShowCurrencySettings(true)}
              className="currency-settings-btn"
              title="Currency Settings"
            >
              💱 Currency
            </button>
            <div className="user-info">
              <span>Welcome, {user?.username || 'Admin'}</span>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
        </div>
        <div className="content-wrapper">
          <Routes>
            {/* Medical Advisor Routes */}
            <Route path="/medical-dashboard" element={<MedicalAdvisorDashboard />} />
            <Route path="/medical-review/:clientId/:retreatId" element={<MedicalReviewDetail />} />
            <Route path="/medical-retreats" element={<MedicalRetreats />} />
            <Route path="/medical-profile/:clientId" element={<MedicalProfile />} />

            {/* Regular Routes */}
            <Route path="/retreats" element={<RetreatsGrid />} />
            <Route path="/houses" element={<HousesGrid />} />
            {/* <Route path="/screening" element={<ScreeningClientsGrid />} /> */}
            <Route path="/clients" element={<UnifiedClientManager />} />
            <Route path="/bookings" element={<BookingsGrid />} />
            <Route path="/medical" element={<MedicalGrid />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/requirements" element={<RequirementsGrid />} />
            <Route path="/analytics" element={
              <div className="coming-soon">
                <h2>Analytics & Reports</h2>
                <p>Coming soon...</p>
              </div>
            } />
          </Routes>
        </div>
      </div>
      {!sidebarCollapsed && isMobile && <div className="sidebar-overlay" onClick={handleSidebarToggle}></div>}
      {showCurrencySettings && (
        <CurrencySettings onClose={() => setShowCurrencySettings(false)} />
      )}
    </div>
  );
};

export default Layout;