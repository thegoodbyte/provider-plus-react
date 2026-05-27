import React, { useCallback, useMemo, useState, useEffect } from 'react';
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

type MenuItem = {
  id: string;
  label: string;
  Icon: any;
};

type MenuSection = {
  id: string;
  label: string;
  Icon: any;
  items: MenuItem[];
};

const getGradientColorForIndex = (index: number, total: number, isActive: boolean = false): string => {
  const colorPalette = [
    { bg: isActive ? 'rgb(219, 234, 254)' : 'rgb(248, 250, 252)' },
    { bg: isActive ? 'rgb(224, 231, 255)' : 'rgb(249, 250, 251)' },
    { bg: isActive ? 'rgb(237, 233, 254)' : 'rgb(248, 250, 252)' },
    { bg: isActive ? 'rgb(240, 249, 255)' : 'rgb(249, 250, 251)' },
    { bg: isActive ? 'rgb(241, 245, 249)' : 'rgb(248, 250, 252)' },
  ];

  const colorIndex = index % colorPalette.length;
  return colorPalette[colorIndex].bg;
};

const getTextColorForIndex = (index: number, total: number, isActive: boolean = false): string => {
  return isActive ? 'rgb(30, 64, 175)' : 'rgb(55, 65, 81)';
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebarOpenSections');
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    window.dispatchEvent(new Event('sidebarCollapsedChange'));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem('sidebarOpenSections', JSON.stringify(openSections));
  }, [openSections]);

  const getMenuSectionsForRole = useCallback((): MenuSection[] => {
    switch (userRole) {
      case 'admin':
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          {
            id: 'clients',
            label: 'Clients',
            Icon: Fi.FiUsers,
            items: [
              { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
              { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
              { id: 'screening', label: 'Screenings', Icon: Fi.FiClipboard },
            ],
          },
          {
            id: 'retreats',
            label: 'Retreat Operations',
            Icon: Fi.FiCalendar,
            items: [
              { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
              { id: 'ceremonies', label: 'Ceremonies', Icon: Fi.FiClock },
              { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
              { id: 'houses', label: 'Houses', Icon: Fi.FiHome },
            ],
          },
          {
            id: 'workflow',
            label: 'Readiness',
            Icon: Fi.FiLayers,
            items: [
              { id: 'workflow', label: 'Readiness Dashboard', Icon: Fi.FiLayers },
              { id: 'retreat-flow', label: 'Retreat Requirements', Icon: Fi.FiCalendar },
              { id: 'retreat-flow-library', label: 'Readiness Library', Icon: Fi.FiBook },
              { id: 'booking-flow', label: 'Client Flow', Icon: Fi.FiLayers },
              { id: 'requirements', label: 'Legacy Requirements', Icon: Fi.FiCheckSquare },
            ],
          },
          {
            id: 'medical',
            label: 'Medical',
            Icon: Fi.FiActivity,
            items: [
              { id: 'medical-dashboard', label: 'Medical Dashboard', Icon: Fi.FiMonitor },
              { id: 'medical-artifacts', label: 'Medical Artifacts', Icon: Fi.FiFileText },
              { id: 'medical-tracking', label: 'Medical Readiness', Icon: Fi.FiHeart },
              { id: 'medical-review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
              { id: 'client-medications', label: 'Client Medications', Icon: Fi.FiPlusSquare },
            ],
          },
          {
            id: 'payments',
            label: 'Payments',
            Icon: Fi.FiCreditCard,
            items: [
              { id: 'payments', label: 'Payments', Icon: Fi.FiCreditCard },
              { id: 'payment-requests', label: 'Payment Requests', Icon: Fi.FiFileText },
            ],
          },
          {
            id: 'operations',
            label: 'Operations',
            Icon: Fi.FiBriefcase,
            items: [
              { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
              { id: 'tasks', label: 'General Tasks', Icon: Fi.FiCheckSquare },
              { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
              { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
            ],
          },
          {
            id: 'misc',
            label: 'Misc',
            Icon: Fi.FiMoreHorizontal,
            items: [
              { id: 'analytics', label: 'Analytics', Icon: Fi.FiBarChart },
            ],
          },
          {
            id: 'admin',
            label: 'Admin',
            Icon: Fi.FiShield,
            items: [
              { id: 'permissions', label: 'Permissions', Icon: Fi.FiShield },
              { id: 'users', label: 'Users', Icon: Fi.FiUser },
            ],
          },
        ];
      case 'medical_staff':
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          {
            id: 'medical',
            label: 'Medical',
            Icon: Fi.FiActivity,
            items: [
              { id: 'medical-dashboard', label: 'Dashboard', Icon: Fi.FiHome },
              { id: 'medical-artifacts', label: 'Medical Artifacts', Icon: Fi.FiFileText },
              { id: 'medical-tracking', label: 'Medical Readiness', Icon: Fi.FiHeart },
              { id: 'review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
              { id: 'medical', label: 'Medical Profiles', Icon: Fi.FiActivity },
              { id: 'client-medications', label: 'Client Medications', Icon: Fi.FiPlusSquare },
            ],
          },
          {
            id: 'retreats',
            label: 'Retreat Operations',
            Icon: Fi.FiCalendar,
            items: [
              { id: 'medical-retreats', label: 'Medical Retreats', Icon: Fi.FiCalendar },
              { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
              { id: 'ceremonies', label: 'Ceremonies', Icon: Fi.FiClock },
              { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
            ],
          },
          {
            id: 'clients',
            label: 'Clients',
            Icon: Fi.FiUsers,
            items: [
              { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
              { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
              { id: 'screening', label: 'Screenings', Icon: Fi.FiClipboard },
            ],
          },
          {
            id: 'readiness',
            label: 'Readiness',
            Icon: Fi.FiLayers,
            items: [
              { id: 'workflow', label: 'Readiness Dashboard', Icon: Fi.FiLayers },
              { id: 'retreat-flow', label: 'Retreat Requirements', Icon: Fi.FiCalendar },
              { id: 'retreat-flow-library', label: 'Readiness Library', Icon: Fi.FiBook },
            ],
          },
          { id: 'operations', label: 'Operations', Icon: Fi.FiBriefcase, items: [
            { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
            { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
            { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
          ] },
        ];
      case 'medical_advisor':
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          { id: 'medical', label: 'Medical', Icon: Fi.FiActivity, items: [
            { id: 'medical-dashboard', label: 'Medical Dashboard', Icon: Fi.FiMonitor },
            { id: 'medical-artifacts', label: 'Medical Artifacts', Icon: Fi.FiFileText },
            { id: 'medical-tracking', label: 'Medical Readiness', Icon: Fi.FiHeart },
            { id: 'review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
          ] },
          { id: 'readiness', label: 'Readiness', Icon: Fi.FiLayers, items: [
            { id: 'workflow', label: 'Readiness Dashboard', Icon: Fi.FiLayers },
            { id: 'retreat-flow', label: 'Retreat Requirements', Icon: Fi.FiCalendar },
            { id: 'retreat-flow-library', label: 'Readiness Library', Icon: Fi.FiBook },
            { id: 'flow-tasks', label: 'Flow Tasks', Icon: Fi.FiList },
          ] },
          { id: 'operations', label: 'Operations', Icon: Fi.FiBriefcase, items: [
            { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
          ] },
        ];
      case 'facilitator':
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          { id: 'retreats', label: 'Retreat Operations', Icon: Fi.FiCalendar, items: [
            { id: 'retreats', label: 'Retreats', Icon: Fi.FiCalendar },
            { id: 'ceremonies', label: 'Ceremonies', Icon: Fi.FiClock },
            { id: 'bookings', label: 'Bookings', Icon: Fi.FiBookOpen },
            { id: 'houses', label: 'Houses', Icon: Fi.FiHome },
          ] },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers, items: [
            { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
            { id: 'potential-clients', label: 'Potential Clients', Icon: Fi.FiUserPlus },
            { id: 'screening', label: 'Screenings', Icon: Fi.FiClipboard },
          ] },
          { id: 'operations', label: 'Operations', Icon: Fi.FiBriefcase, items: [
            { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
            { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
          ] },
        ];
      case 'user':
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers, items: [{ id: 'clients', label: 'Clients', Icon: Fi.FiUsers }] },
          { id: 'communications', label: 'Communications', Icon: Fi.FiBell, items: [{ id: 'reminders', label: 'Reminders', Icon: Fi.FiBell }] },
        ];
      default:
        return [
          { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers, items: [{ id: 'clients', label: 'Clients', Icon: Fi.FiUsers }] },
        ];
    }
  }, [userRole]);

  const menuSections = useMemo(() => getMenuSectionsForRole(), [getMenuSectionsForRole]);

  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    const activeSection = menuSections.find((section) => section.items.some((item) => item.id === activeItem));
    if (activeSection) {
      setOpenSections((prev) => ({ ...prev, [activeSection.id]: true }));
    }
  }, [activeItem, menuSections]);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
              {menuSections.map((section, sectionIndex) => {
                const sectionIsActive = section.items.some((item) => item.id === activeItem);
                const sectionIsOpen = openSections[section.id] || sectionIsActive;
                const SectionIcon = section.Icon;
                const sectionBgColor = getGradientColorForIndex(sectionIndex, menuSections.length, sectionIsActive);
                const sectionTextColor = getTextColorForIndex(sectionIndex, menuSections.length, sectionIsActive);
                const sectionButton = (
                  <button
                    onClick={() => isExpanded ? toggleSection(section.id) : onItemClick(section.items[0]?.id || section.id)}
                    style={{ backgroundColor: sectionBgColor, color: sectionTextColor }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-apple
                      transition-all duration-200 text-left
                      ${sectionIsActive ? 'border border-blue-200 shadow-sm' : 'border border-transparent hover:bg-white hover:shadow-sm'}
                      ${!isExpanded && 'justify-center px-2'}
                    `}
                  >
                    {React.createElement(SectionIcon as any, { className: "w-5 h-5 flex-shrink-0" })}
                    {isExpanded && (
                      <>
                        <span className={`text-sm font-semibold whitespace-nowrap ${sectionIsActive ? 'font-bold' : ''}`}>
                          {section.label}
                        </span>
                        {React.createElement(Fi.FiChevronDown as any, {
                          className: `ml-auto w-4 h-4 transition-transform ${sectionIsOpen ? 'rotate-180' : ''}`
                        })}
                      </>
                    )}
                  </button>
                );

                if (!isExpanded) {
                  return (
                    <li key={section.id}>
                      <Tooltip
                        title={section.label}
                        placement="right"
                        arrow
                        enterDelay={200}
                      >
                        {sectionButton}
                      </Tooltip>
                    </li>
                  );
                }

                return (
                  <li key={section.id}>
                    {sectionButton}
                    {sectionIsOpen && (
                      <ul className="mt-1 ml-3 space-y-1 border-l border-apple-gray-200 pl-2">
                        {section.items.map((item) => {
                          const isActive = activeItem === item.id;
                          const IconComponent = item.Icon;
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => onItemClick(item.id)}
                                className={`
                                  w-full flex items-center gap-2 rounded-apple px-3 py-1.5 text-left
                                  transition-all duration-200
                                  ${isActive ? 'bg-blue-50 text-blue-800 border border-blue-100 shadow-sm' : 'text-apple-gray-600 border border-transparent hover:bg-apple-gray-50 hover:text-apple-gray-900'}
                                `}
                              >
                                {React.createElement(IconComponent as any, { className: "w-4 h-4 flex-shrink-0" })}
                                <span className={`text-sm whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                  {item.label}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
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
