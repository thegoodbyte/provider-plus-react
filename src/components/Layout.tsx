import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import RetreatsGrid from './RetreatsGrid';
import HousesGrid from './HousesGrid';
import ClientsGrid from './ClientsGrid';
import BookingsGrid from './BookingsGrid';
import MedicalGrid from './MedicalGrid';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import './Layout.css';

const Layout: React.FC = () => {
  const [activeItem, setActiveItem] = useState('retreats');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleItemClick = (item: string) => {
    setActiveItem(item);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const renderContent = () => {
    switch (activeItem) {
      case 'retreats':
        return <RetreatsGrid />;
      case 'houses':
        return <HousesGrid />;
      case 'clients':
        return <ClientsGrid />;
      case 'bookings':
        return <BookingsGrid />;
      case 'medical':
        return <MedicalGrid />;
      case 'reminders':
        return <RemindersPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'analytics':
        return (
          <div className="coming-soon">
            <h2>Analytics & Reports</h2>
            <p>Coming soon...</p>
          </div>
        );
      default:
        return <RetreatsGrid />;
    }
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
        <div className="content-wrapper">
          {renderContent()}
        </div>
      </div>
      {!sidebarCollapsed && isMobile && <div className="sidebar-overlay" onClick={handleSidebarToggle}></div>}
    </div>
  );
};

export default Layout;