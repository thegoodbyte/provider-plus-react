import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onItemClick, isCollapsed, onToggle }) => {
  const menuItems: MenuItem[] = [
    {
      id: 'retreats',
      label: 'Retreats',
      icon: '📅',
      description: 'Manage retreat programs'
    },
    {
      id: 'houses',
      label: 'Houses',
      icon: '🏠',
      description: 'Manage retreat houses'
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: '👥',
      description: 'Manage client information'
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: '📋',
      description: 'Retreat-client bookings'
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: '🔔',
      description: 'Manage client reminders'
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: '💳',
      description: 'Manage retreat payments'
    },
    {
      id: 'medical',
      label: 'Medical',
      icon: '🏥',
      description: 'EKG and liver panel tracking'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '📊',
      description: 'View reports and analytics'
    }
  ];

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

        <button className="nav-link logout-link" title={isCollapsed ? 'Logout' : ''}>
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