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
  const isMedicalAdvisor = userRole === 'medical_advisor';

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    window.dispatchEvent(new Event('sidebarCollapsedChange'));
  }, [isCollapsed]);

  const menuItems = isMedicalAdvisor ? [
    { id: 'medical-dashboard', label: 'Dashboard', Icon: Fi.FiHome },
    { id: 'medical-retreats', label: 'Retreats', Icon: Fi.FiCalendar },
  ] : [
    { id: 'potential-clients', label: 'Clients', Icon: Fi.FiUsers },
    { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
    { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
    { id: 'medical', label: 'Medical', Icon: Fi.FiActivity },
    { id: 'medical-tracking', label: 'Medical Tracking', Icon: Fi.FiHeart },
    { id: 'houses', label: 'Houses', Icon: Fi.FiHome },
    { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
    { id: 'payments', label: 'Payments', Icon: Fi.FiCreditCard },
    { id: 'requirements', label: 'Requirements', Icon: Fi.FiCheckSquare },
  ];

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
              <div className="w-10 h-10 bg-gradient-to-br from-apple-blue to-blue-600 rounded-apple flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-bold">P</span>
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
              {menuItems.map((item) => {
                const isActive = activeItem === item.id;
                const IconComponent = item.Icon;
                const button = (
                  <button
                    onClick={() => onItemClick(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-apple
                      transition-all duration-200 text-left
                      ${isActive
                        ? 'bg-apple-blue text-white shadow-apple-sm'
                        : 'text-apple-gray-700 hover:bg-apple-gray-100'
                      }
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
                      {isMedicalAdvisor ? 'Medical Advisor' : 'Administrator'}
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