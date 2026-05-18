import React, { useState, useEffect } from 'react';
import { Tooltip } from '@mui/material';
import * as Fi from 'react-icons/fi';

interface AppleSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userRole?: string;
}

// Professional gradient using 3 colors: Blue, Purple, and Gray with subtle variations
const getGradientColorForIndex = (index: number, total: number, isActive: boolean = false): string => {
  // Create a professional gradient using blue → purple → slate shades
  // Each color family has light, medium, and deeper variations for smooth transitions
  const colorPalette = [
    // Light Blue
    { bg: isActive ? 'rgb(59, 130, 246)' : 'rgb(219, 234, 254)', text: isActive ? 'white' : 'rgb(30, 64, 175)' },
    // Medium Blue
    { bg: isActive ? 'rgb(37, 99, 235)' : 'rgb(191, 219, 254)', text: isActive ? 'white' : 'rgb(29, 78, 216)' },
    // Deep Blue
    { bg: isActive ? 'rgb(29, 78, 216)' : 'rgb(147, 197, 253)', text: isActive ? 'white' : 'rgb(30, 58, 138)' },
    // Blue-Indigo transition
    { bg: isActive ? 'rgb(67, 56, 202)' : 'rgb(165, 180, 252)', text: isActive ? 'white' : 'rgb(55, 48, 163)' },
    // Light Indigo
    { bg: isActive ? 'rgb(99, 102, 241)' : 'rgb(196, 181, 253)', text: isActive ? 'white' : 'rgb(79, 70, 229)' },
    // Medium Purple
    { bg: isActive ? 'rgb(124, 58, 237)' : 'rgb(221, 214, 254)', text: isActive ? 'white' : 'rgb(107, 33, 168)' },
    // Deep Purple
    { bg: isActive ? 'rgb(109, 40, 217)' : 'rgb(196, 181, 253)', text: isActive ? 'white' : 'rgb(88, 28, 135)' },
    // Purple-Slate transition
    { bg: isActive ? 'rgb(100, 116, 139)' : 'rgb(203, 213, 225)', text: isActive ? 'white' : 'rgb(71, 85, 105)' },
    // Light Slate
    { bg: isActive ? 'rgb(71, 85, 105)' : 'rgb(226, 232, 240)', text: isActive ? 'white' : 'rgb(51, 65, 85)' },
    // Medium Slate
    { bg: isActive ? 'rgb(51, 65, 85)' : 'rgb(203, 213, 225)', text: isActive ? 'white' : 'rgb(30, 41, 59)' },
    // Blue-Gray
    { bg: isActive ? 'rgb(30, 64, 175)' : 'rgb(191, 219, 254)', text: isActive ? 'white' : 'rgb(30, 58, 138)' },
    // Light Blue return
    { bg: isActive ? 'rgb(14, 165, 233)' : 'rgb(186, 230, 253)', text: isActive ? 'white' : 'rgb(2, 132, 199)' },
    // Sky Blue
    { bg: isActive ? 'rgb(2, 132, 199)' : 'rgb(125, 211, 252)', text: isActive ? 'white' : 'rgb(3, 105, 161)' },
    // Indigo return
    { bg: isActive ? 'rgb(79, 70, 229)' : 'rgb(165, 180, 252)', text: isActive ? 'white' : 'rgb(67, 56, 202)' },
    // Purple return
    { bg: isActive ? 'rgb(147, 51, 234)' : 'rgb(233, 213, 255)', text: isActive ? 'white' : 'rgb(126, 34, 206)' },
  ];

  // Use modulo to cycle through colors if there are more items than colors
  const colorIndex = index % colorPalette.length;
  return colorPalette[colorIndex].bg;
};

const getTextColorForIndex = (index: number, total: number, isActive: boolean = false): string => {
  const colorPalette = [
    { text: isActive ? 'white' : 'rgb(30, 64, 175)' }, // Light blue text
    { text: isActive ? 'white' : 'rgb(29, 78, 216)' }, // Medium blue text
    { text: isActive ? 'white' : 'rgb(30, 58, 138)' }, // Deep blue text
    { text: isActive ? 'white' : 'rgb(55, 48, 163)' }, // Blue-indigo text
    { text: isActive ? 'white' : 'rgb(79, 70, 229)' }, // Light indigo text
    { text: isActive ? 'white' : 'rgb(107, 33, 168)' }, // Medium purple text
    { text: isActive ? 'white' : 'rgb(88, 28, 135)' }, // Deep purple text
    { text: isActive ? 'white' : 'rgb(71, 85, 105)' }, // Purple-slate text
    { text: isActive ? 'white' : 'rgb(51, 65, 85)' }, // Light slate text
    { text: isActive ? 'white' : 'rgb(30, 41, 59)' }, // Medium slate text
    { text: isActive ? 'white' : 'rgb(30, 58, 138)' }, // Blue-gray text
    { text: isActive ? 'white' : 'rgb(2, 132, 199)' }, // Light blue return text
    { text: isActive ? 'white' : 'rgb(3, 105, 161)' }, // Sky blue text
    { text: isActive ? 'white' : 'rgb(67, 56, 202)' }, // Indigo return text
    { text: isActive ? 'white' : 'rgb(126, 34, 206)' }, // Purple return text
  ];

  const colorIndex = index % colorPalette.length;
  return colorPalette[colorIndex].text;
};

const AppleSidebar: React.FC<AppleSidebarProps> = ({
  activeItem,
  onItemClick,
  isOpen,
  onClose,
  onLogout,
  userRole
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [isHovered, setIsHovered] = useState(false);
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    window.dispatchEvent(new Event('sidebarCollapsedChange'));
  }, [isCollapsed]);

  const getMenuItemsForRole = () => {
    switch (userRole) {
      case 'admin':
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
          { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
          { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
          { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
          { id: 'workflow', label: 'Workflow', Icon: Fi.FiLayers },
          { id: 'retreat-flow', label: 'Retreat Flow', Icon: Fi.FiCalendar },
          { id: 'retreat-flow-library', label: 'Flow Library', Icon: Fi.FiBook },
          { id: 'booking-flow', label: 'Booking Flow', Icon: Fi.FiLayers },
          { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
          { id: 'medical', label: 'Medical', Icon: Fi.FiActivity },
          { id: 'medical-tracking', label: 'Medical Tracking', Icon: Fi.FiHeart },
          { id: 'medical-review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
          { id: 'medical-dashboard', label: 'Medical Dashboard', Icon: Fi.FiMonitor },
          { id: 'client-medications', label: 'Client Medications', Icon: Fi.FiPlusSquare },
          { id: 'houses', label: 'Houses', Icon: Fi.FiHome },
          { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
          { id: 'payments', label: 'Payments', Icon: Fi.FiCreditCard },
          { id: 'payment-requests', label: 'Payment Requests', Icon: Fi.FiFileText },
          { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
          { id: 'requirements', label: 'Requirements', Icon: Fi.FiCheckSquare },
          { id: 'permissions', label: 'Permissions', Icon: Fi.FiShield },
          { id: 'users', label: 'Users', Icon: Fi.FiUser },
          { id: 'tasks', label: 'Tasks', Icon: Fi.FiList },
          { id: 'analytics', label: 'Analytics', Icon: Fi.FiBarChart },
        ];
      case 'medical_staff':
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'medical-dashboard', label: 'Dashboard', Icon: Fi.FiHome },
          { id: 'medical-tracking', label: 'Medical Tracking', Icon: Fi.FiHeart },
          { id: 'review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
          { id: 'workflow', label: 'Workflow', Icon: Fi.FiLayers },
          { id: 'retreat-flow', label: 'Retreat Flow', Icon: Fi.FiCalendar },
          { id: 'retreat-flow-library', label: 'Flow Library', Icon: Fi.FiBook },
          { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
          { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
          { id: 'client-medications', label: 'Client Medications', Icon: Fi.FiPlusSquare },
          { id: 'medical-retreats', label: 'Medical Retreats', Icon: Fi.FiCalendar },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
          { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
          { id: 'medical', label: 'Medical Profiles', Icon: Fi.FiActivity },
          { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
          { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
          { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
        ];
      case 'medical_advisor':
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'medical-dashboard', label: 'Medical Dashboard', Icon: Fi.FiMonitor },
          { id: 'medical-tracking', label: 'Medical Tracking', Icon: Fi.FiHeart },
          { id: 'review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
          { id: 'workflow', label: 'Workflow', Icon: Fi.FiLayers },
          { id: 'retreat-flow', label: 'Retreat Flow', Icon: Fi.FiCalendar },
          { id: 'retreat-flow-library', label: 'Flow Library', Icon: Fi.FiBook },
          { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
          { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
        ];
      case 'facilitator':
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
          { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
          { id: 'houses', label: 'Houses', Icon: Fi.FiHome },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
          { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
          { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
        ];
      case 'user':
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
          { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
        ];
      default:
        return [
          { id: 'launcher', label: 'Home', Icon: Fi.FiGrid },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
        ];
    }
  };

  const menuItems = getMenuItemsForRole();

  const isExpanded = !isCollapsed || isHovered;

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed top-0 left-0 h-full z-40
          bg-white/80 backdrop-blur-xl
          border-r border-apple-gray-200
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${isExpanded ? 'w-64' : 'w-20'}
        `}
      >
        <nav className="h-full flex flex-col">
          {/* Header */}
          <div className={`px-4 py-5 border-b border-apple-gray-100 ${!isExpanded && 'px-2 py-4'}`}>
            <div className="flex items-center justify-between">
              {/* Mobile close button */}
              <button
                className="lg:hidden p-2 -ml-2 text-apple-gray-500 hover:text-apple-gray-700"
                onClick={onClose}
              >
                {React.createElement(Fi.FiX as any, { className: "w-5 h-5" })}
              </button>
            </div>

            <div className={`flex items-center gap-3 ${!isExpanded && 'justify-center'}`}>
              <div className="w-10 h-10 rounded-apple overflow-hidden bg-white flex items-center justify-center flex-shrink-0 border border-apple-gray-100">
                <img
                  src={`${process.env.PUBLIC_URL}/images/icon/retreategnine.png`}
                  alt="Provider Plus"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              {isExpanded && (
                <span className="text-lg font-semibold text-apple-gray-900 whitespace-nowrap">
                  Provider Plus
                </span>
              )}
            </div>
          </div>

          {/* Collapse Toggle Button (Desktop only) */}
          <div className={`hidden lg:block px-3 pt-4 pb-2 ${!isExpanded && 'px-2'}`}>
            <button
              onClick={handleToggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-apple hover:bg-apple-gray-100 transition-colors"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {React.createElement(Fi.FiChevronLeft as any, {
                className: `w-5 h-5 text-apple-gray-500 transition-transform duration-300 ${!isExpanded && 'rotate-180'}`
              })}
              {isExpanded && (
                <span className="ml-2 text-sm text-apple-gray-600">
                  Collapse
                </span>
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-2">
            <ul className={`px-3 space-y-1 ${!isExpanded && 'px-2'}`}>
              {menuItems.map((item, index) => {
                const isActive = activeItem === item.id;
                const IconComponent = item.Icon;
                const bgColor = getGradientColorForIndex(index, menuItems.length, isActive);
                const textColor = getTextColorForIndex(index, menuItems.length, isActive);
                const button = (
                  <button
                    onClick={() => onItemClick(item.id)}
                    style={{
                      backgroundColor: bgColor,
                      color: textColor
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-apple
                      transition-all duration-200 text-left
                      ${isActive ? 'shadow-lg transform scale-105' : 'hover:scale-102 hover:shadow-md'}
                      ${!isExpanded && 'justify-center px-2'}
                    `}
                  >
                    {React.createElement(IconComponent as any, { className: "w-5 h-5 flex-shrink-0" })}
                    {isExpanded && (
                      <>
                        <span className={`text-sm font-medium whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>
                          {item.label}
                        </span>
                        {isActive && (
                          <div className="ml-auto w-1 h-4 bg-white/30 rounded-full" />
                        )}
                      </>
                    )}
                  </button>
                );

                if (!isExpanded) {
                  return (
                    <li key={item.id}>
                      <Tooltip
                        title={item.label}
                        placement="right"
                        arrow
                        enterDelay={200}
                      >
                        {button}
                      </Tooltip>
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    {button}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* User Section */}
          <div className={`border-t border-apple-gray-100 p-4 ${!isExpanded && 'p-2'}`}>
            {/* User info */}
            <div className={`px-3 py-2 mb-2 ${!isExpanded && 'px-1 py-1'}`}>
              <div className={`flex items-center gap-3 ${!isExpanded && 'justify-center'}`}>
                <div className="w-8 h-8 bg-apple-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-apple-gray-600 text-xs font-medium">
                    {userRole?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                {isExpanded && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-apple-gray-500 truncate">
                      {userRole === 'admin' ? 'Administrator' :
                       userRole === 'medical_staff' ? 'Medical Staff' :
                       userRole === 'facilitator' ? 'Facilitator' :
                       userRole === 'user' ? 'User' : 'User'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Logout button */}
            {!isExpanded ? (
              <Tooltip title="Sign Out" placement="right" arrow>
                <button
                  onClick={onLogout}
                  className="
                    w-full flex items-center justify-center p-2 rounded-apple
                    text-apple-gray-600 hover:bg-apple-gray-100
                    transition-all duration-200
                  "
                >
                  {React.createElement(Fi.FiLogOut as any, { className: "w-5 h-5" })}
                </button>
              </Tooltip>
            ) : (
              <button
                onClick={onLogout}
                className="
                  w-full flex items-center gap-3 px-3 py-2 rounded-apple
                  text-apple-gray-600 hover:bg-apple-gray-100
                  transition-all duration-200
                "
              >
                {React.createElement(Fi.FiLogOut as any, { className: "w-5 h-5 flex-shrink-0" })}
                <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>
              </button>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
};

export default AppleSidebar;
