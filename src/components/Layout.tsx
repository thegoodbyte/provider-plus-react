import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import RetreatsGrid from './RetreatsGrid';
import HousesGrid from './HousesGrid';
import ClientsGrid from './ClientsGrid';
import BookingsGrid from './BookingsGrid';
import MedicalGrid from './MedicalGrid';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get active item from current path
  const getActiveItemFromPath = () => {
    const path = location.pathname;
    if (path.startsWith('/houses')) return 'houses';
    if (path.startsWith('/clients')) return 'clients';
    if (path.startsWith('/bookings')) return 'bookings';
    if (path.startsWith('/medical')) return 'medical';
    if (path.startsWith('/reminders')) return 'reminders';
    if (path.startsWith('/payments')) return 'payments';
    if (path.startsWith('/analytics')) return 'analytics';
    return 'retreats'; // default to retreats
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

  // Redirect to /retreats if on root path
  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/retreats', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleItemClick = (item: string) => {
    navigate(`/${item}`);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };


  return (
    <div className="layout">
      <Sidebar
        activeItem={activeItem}
        onItemClick={handleItemClick}
        isCollapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="app-header">
          <h1>Provider Plus</h1>
          <div className="user-info">
            <span>Welcome, {user?.username || 'Admin'}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
        <div className="content-wrapper">
          <Routes>
            <Route path="/retreats" element={<RetreatsGrid />} />
            <Route path="/houses" element={<HousesGrid />} />
            <Route path="/clients" element={<ClientsGrid />} />
            <Route path="/bookings" element={<BookingsGrid />} />
            <Route path="/medical" element={<MedicalGrid />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
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
    </div>
  );
};

export default Layout;