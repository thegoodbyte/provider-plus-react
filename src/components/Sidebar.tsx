import { Activity, BarChart2, Bell, Calendar, Clipboard, CreditCard, DollarSign, Grid, Home as HomeIcon, LogOut, Mail, Menu, Users, X } from 'lucide-react';
import React from 'react';
import './Sidebar.css';

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
      id: 'launcher',
      label: 'Home',
      icon: Grid,
      description: 'Pick a module'
    },
    {
      id: 'medical-dashboard',
      label: 'Reviews',
      icon: Activity,
      description: 'Review medical records'
    },
    {
      id: 'medical-retreats',
      label: 'Retreats',
      icon: Calendar,
      description: 'View upcoming retreats'
    }
  ];

  // Regular menu items for admins and other users
  const regularMenuItems: MenuItem[] = [
    {
      id: 'launcher',
      label: 'Home',
      icon: Grid,
      description: 'Pick a module'
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: Users,
      description: 'Manage all clients (potential, screening, active)'
    },
    {
      id: 'screening',
      label: 'Screening',
      icon: Clipboard,
      description: 'Manage screening clients'
    },
    {
      id: 'retreats',
      label: 'Retreats',
      icon: Calendar,
      description: 'Manage retreat programs'
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: Clipboard,
      description: 'Retreat-client bookings'
    },
    {
      id: 'retreat-flow',
      label: 'Retreat Readiness Setup',
      icon: Calendar,
      description: 'Per-retreat step setup and timing'
    },
    {
      id: 'retreat-flow-library',
      label: 'Booking Step Setup',
      icon: Clipboard,
      description: 'Master booking step configuration'
    },
    {
      id: 'booking-step-deadlines',
      label: 'Step Deadlines',
      icon: Calendar,
      description: 'All booking-step deadlines across retreats'
    },
    {
      id: 'reserve-lists',
      label: 'Reserve Lists',
      icon: Users,
      description: 'Waiting list and reserve list management'
    },
    {
      id: 'houses',
      label: 'Houses',
      icon: HomeIcon,
      description: 'Manage retreat houses'
    },
    {
      id: 'reminders',
      label: 'Reminders',
      icon: Bell,
      description: 'Manage client reminders'
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: CreditCard,
      description: 'Manage retreat payments'
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: DollarSign,
      description: 'Manage expenses (retreat and general)'
    },
    {
      id: 'communications',
      label: 'Communications',
      icon: Mail,
      description: 'Gmail settings, templates, and sent email logs'
    },
    {
      id: 'medical',
      label: 'Medical',
      icon: Activity,
      description: 'EKG and liver panel tracking'
    },
    {
      id: 'medical-review-requests',
      label: 'Review Requests',
      icon: Activity,
      description: 'Medical review queue and history'
    },
    {
      id: 'requirements',
      label: 'Requirements',
      icon: Clipboard,
      description: 'Manage retreat requirements'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart2,
      description: 'View reports and analytics'
    }
  ];

  // Choose menu items based on user role
  const menuItems = userRole === 'medical_advisor' ? medicalAdvisorMenuItems : regularMenuItems;
  const getBookingStepAccentClass = (itemId: string) => {
    if (itemId === 'retreat-flow') return 'nav-link-readiness';
    if (itemId === 'retreat-flow-library') return 'nav-link-step-setup';
    if (itemId === 'booking-flow' || itemId === 'booking-step-deadlines') return 'nav-link-step-deadlines';
    return '';
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-section">
          <div className="logo-icon">
            <img
              src={`${process.env.PUBLIC_URL}/images/icon/retreategnine.png`}
              alt="Provider Plus"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
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
                className={`nav-link ${getBookingStepAccentClass(item.id)} ${activeItem === item.id ? 'active' : ''}`}
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
