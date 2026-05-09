import React from 'react';
import './Sidebar.css';
import {
  FiUsers,
  FiCalendar,
  FiActivity,
  FiHome,
  FiBell,
  FiCreditCard,
  FiClipboard,
  FiBarChart2,
  FiLogOut,
  FiMenu,
  FiX
} from 'react-icons/fi';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
  userRole?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  description: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemClick, isCollapsed, onToggle, onLogout, userRole }) => {
  // Medical advisor specific menu
  const medicalAdvisorMenuItems: MenuItem[] = [
    {
      id: 'medical-dashboard',
      label: 'Reviews',
      icon: FiActivity,
      description: 'Review medical records'
    },
    {
      id: 'medical-retreats',
      label: 'Retreats',
      icon: FiCalendar,
      description: 'View upcoming retreats'
    }
  ];

  // Regular menu items for admins and other users
  const regularMenuItems: MenuItem[] = [
    {
      id: 'clients',
      label: 'Clients',
      icon: FiUsers,
      description: 'Manage all clients (potential, screening, active)'
    },
    {
      id: 'screening',
      label: 'Screening',
      icon: FiClipboard,
      description: 'Manage screening clients'
    },
    {
      id: 'retreats',
      label: 'Retreats',
      icon: FiCalendar,
      description: 'Manage retreat programs'
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: FiClipboard,
      description: 'Retreat-client bookings'
    },
    {
      id: 'houses',
      label: 'Houses',
      icon: FiHome,
      description: 'Manage retreat houses'
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: FiBell,
      description: 'Manage client reminders'
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: FiCreditCard,
      description: 'Manage retreat payments'
    },
    {
      id: 'medical',
      label: 'Medical',
      icon: FiActivity,
      description: 'EKG and liver panel tracking'
    },
    {
      id: 'requirements',
      label: 'Requirements',
      icon: FiClipboard,
      description: 'Manage retreat requirements'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: FiBarChart2,
      description: 'View reports and analytics'
    }
  ];

  // Choose menu items based on user role
  const menuItems = userRole === 'medical_advisor' ? medicalAdvisorMenuItems : regularMenuItems;

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-section">
          <div className="logo-icon">
            🏔️
          </div>
          {!isCollapsed && (
            <div className="logo-text">
              <h1>Retreat</h1>
              <span>Management</span>
            </div>
          )}
        </div>
        <button className="toggle-btn" onClick={onToggle}>
          ☰
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-link ${activeItem === item.id ? 'active' : ''}`}
                onClick={() => onItemClick(item.id)}
                title={isCollapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && (
                  <div className="nav-content">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-description">{item.description}</span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-divider"></div>
        <button className="nav-link settings-link" title={isCollapsed ? 'Settings' : ''}>
          <span className="nav-icon">
            ⚙️
          </span>
          {!isCollapsed && <span className="nav-label">Settings</span>}
        </button>

        <button className="nav-link logout-link" title={isCollapsed ? 'Logout' : ''} onClick={onLogout}>
          <span className="nav-icon">
            🚪
          </span>
          {!isCollapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;