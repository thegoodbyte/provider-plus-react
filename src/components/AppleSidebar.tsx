import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Tooltip } from '@mui/material';
import * as Fi from 'react-icons/fi';
import { api } from '../services/api';

interface AppleSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userRole?: string;
  user?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    originalRole?: string;
    impersonatedBy?: string;
    impersonationType?: string;
  } | null;
  appMode?: 'normal' | 'retreat' | 'shopping';
  selectedRetreatLabel?: string;
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

type RolePermissions = Record<string, string[]>;

const NAVIGATION_PERMISSIONS_STORAGE_KEY = 'navigationPermissions:v1';

const FULL_MENU_SECTIONS: MenuSection[] = [
  { id: 'home', label: 'Home', Icon: Fi.FiGrid, items: [{ id: 'launcher', label: 'Home', Icon: Fi.FiGrid }] },
  {
    id: 'clients',
    label: 'Clients',
    Icon: Fi.FiUsers,
    items: [
      { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
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
      { id: 'booster-offers', label: 'Booster Offers', Icon: Fi.FiZap },
      { id: 'retreat-flow', label: 'Retreat Readiness Setup', Icon: Fi.FiCalendar },
      { id: 'retreat-flow-library', label: 'Booking Step Setup', Icon: Fi.FiLayers },
      { id: 'booking-flow', label: 'Booking Flow', Icon: Fi.FiCheckSquare },
      { id: 'booking-step-deadlines', label: 'Step Deadlines', Icon: Fi.FiCalendar },
      { id: 'scheduled-reminders', label: 'Scheduled Reminders', Icon: Fi.FiBell },
      { id: 'reserve-lists', label: 'Reserve Lists', Icon: Fi.FiBookmark },
      { id: 'booking-documents', label: 'Document Library', Icon: Fi.FiFileText },
      { id: 'booking-document-types', label: 'Booking Document Types', Icon: Fi.FiSettings },
    ],
  },
  {
    id: 'workflow',
    label: 'Readiness',
    Icon: Fi.FiLayers,
    items: [],
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
    ],
  },
  {
    id: 'forms',
    label: 'Client Forms',
    Icon: Fi.FiFileText,
    items: [
      { id: 'client-forms', label: 'Forms overview', Icon: Fi.FiFileText },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    Icon: Fi.FiCreditCard,
    items: [
      { id: 'payments', label: 'Payments', Icon: Fi.FiCreditCard },
      { id: 'payment-receipts', label: 'Receipts', Icon: Fi.FiFileText },
      { id: 'payment-requests', label: 'Payment Requests', Icon: Fi.FiFileText },
      { id: 'expenses', label: 'Expenses', Icon: Fi.FiDollarSign },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    Icon: Fi.FiBriefcase,
    items: [
      { id: 'needs-attention', label: 'Needs Attention', Icon: Fi.FiAlertTriangle },
      { id: 'ir-notifications', label: 'Notifications', Icon: Fi.FiBell },
      { id: 'assistant', label: 'Assistant', Icon: Fi.FiCpu },
      { id: 'tasks', label: 'General Tasks', Icon: Fi.FiCheckSquare },
      { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
      { id: 'contact-book', label: 'Contact Book', Icon: Fi.FiBook },
      { id: 'referrals', label: 'Referrals', Icon: Fi.FiShare2 },
      { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
    ],
  },
  {
    id: 'misc',
    label: 'Misc',
    Icon: Fi.FiMoreHorizontal,
    items: [
      { id: 'file-uploads', label: 'File Uploads', Icon: Fi.FiFolder },
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
      { id: 'audit-logs', label: 'Audit Logs', Icon: Fi.FiActivity },
      { id: 'backups', label: 'Data Backup', Icon: Fi.FiDatabase },
    ],
  },
];

const getStoredNavigationPermissions = (): RolePermissions | null => {
  const raw = localStorage.getItem(NAVIGATION_PERMISSIONS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const filterMenuSections = (sections: MenuSection[], allowedItems: string[]) => {
  const allowed = new Set(allowedItems);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowed.has(item.id)),
    }))
    .filter((section) => section.items.length > 0);
};

const getNavigationRole = (userRole?: string) => {
  return userRole;
};

const getTextColor = (isActive: boolean = false): string => {
  return isActive ? 'rgb(17, 24, 39)' : 'rgb(55, 65, 81)';
};

const BOOKING_STEP_NAV_ACCENTS: Record<string, { border: string; background: string; activeBackground: string; color: string }> = {
  'retreat-flow': {
    border: 'rgb(125, 211, 252)',
    background: 'rgba(219, 234, 254, 0.9)',
    activeBackground: 'rgba(191, 219, 254, 1)',
    color: 'rgb(30, 64, 175)',
  },
  'retreat-flow-library': {
    border: 'rgb(196, 181, 253)',
    background: 'rgba(237, 233, 254, 0.92)',
    activeBackground: 'rgba(221, 214, 254, 1)',
    color: 'rgb(91, 33, 182)',
  },
  'booking-flow': {
    border: 'rgb(134, 239, 172)',
    background: 'rgba(220, 252, 231, 0.92)',
    activeBackground: 'rgba(187, 247, 208, 1)',
    color: 'rgb(22, 101, 52)',
  },
  'booking-step-deadlines': {
    border: 'rgb(134, 239, 172)',
    background: 'rgba(220, 252, 231, 0.92)',
    activeBackground: 'rgba(187, 247, 208, 1)',
    color: 'rgb(22, 101, 52)',
  },
};

const AppleSidebar: React.FC<AppleSidebarProps> = ({
  activeItem,
  onItemClick,
  isOpen,
  onClose,
  onLogout,
  userRole,
  user,
  appMode = 'normal',
  selectedRetreatLabel
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [permissionVersion, setPermissionVersion] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [menuSearch, setMenuSearch] = useState('');
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

  useEffect(() => {
    const refreshNavigationPermissions = () => setPermissionVersion((version) => version + 1);
    window.addEventListener('storage', refreshNavigationPermissions);
    window.addEventListener('navigationPermissionsChange', refreshNavigationPermissions);
    return () => {
      window.removeEventListener('storage', refreshNavigationPermissions);
      window.removeEventListener('navigationPermissionsChange', refreshNavigationPermissions);
    };
  }, []);

  const navigationRole = getNavigationRole(userRole);

  const getMenuSectionsForRole = useCallback((): MenuSection[] => {
    void permissionVersion;
    const configuredPermissions = getStoredNavigationPermissions();
    const configuredItems = navigationRole ? configuredPermissions?.[navigationRole] : undefined;
    if (configuredItems) {
      return filterMenuSections(FULL_MENU_SECTIONS, configuredItems);
    }

    switch (navigationRole) {
      case 'admin':
        return FULL_MENU_SECTIONS.filter((section) => section.items.length > 0);
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
            ],
          },
          {
            id: 'forms',
            label: 'Client Forms',
            Icon: Fi.FiFileText,
            items: [
              { id: 'client-forms', label: 'Forms overview', Icon: Fi.FiFileText },
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
              { id: 'retreat-flow', label: 'Retreat Readiness Setup', Icon: Fi.FiCalendar },
              { id: 'retreat-flow-library', label: 'Booking Step Setup', Icon: Fi.FiLayers },
              { id: 'booking-flow', label: 'Booking Flow', Icon: Fi.FiCheckSquare },
              { id: 'booking-step-deadlines', label: 'Step Deadlines', Icon: Fi.FiCalendar },
              { id: 'scheduled-reminders', label: 'Scheduled Reminders', Icon: Fi.FiBell },
              { id: 'booking-documents', label: 'Document Library', Icon: Fi.FiFileText },
              { id: 'booking-document-types', label: 'Booking Document Types', Icon: Fi.FiSettings },
            ],
          },
          {
            id: 'clients',
            label: 'Clients',
            Icon: Fi.FiUsers,
            items: [
              { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
              { id: 'screening', label: 'Screenings', Icon: Fi.FiClipboard },
            ],
          },
          { id: 'operations', label: 'Operations', Icon: Fi.FiBriefcase, items: [
            { id: 'assistant', label: 'Assistant', Icon: Fi.FiCpu },
            { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
            { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
          ] },
          { id: 'misc', label: 'Misc', Icon: Fi.FiMoreHorizontal, items: [
            { id: 'file-uploads', label: 'File Uploads', Icon: Fi.FiFolder },
          ] },
        ];
      case 'medical_advisor':
        return [
          { id: 'medical', label: 'Medical', Icon: Fi.FiActivity, items: [
            { id: 'medical-dashboard', label: 'Medical Dashboard', Icon: Fi.FiMonitor },
            { id: 'review-requests', label: 'Review Requests', Icon: Fi.FiInbox },
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
            { id: 'booster-offers', label: 'Booster Offers', Icon: Fi.FiZap },
          ] },
          { id: 'clients', label: 'Clients', Icon: Fi.FiUsers, items: [
            { id: 'clients', label: 'Clients', Icon: Fi.FiUsers },
            { id: 'screening', label: 'Screenings', Icon: Fi.FiClipboard },
          ] },
          { id: 'operations', label: 'Operations', Icon: Fi.FiBriefcase, items: [
            { id: 'reminders', label: 'Reminders', Icon: Fi.FiBell },
            { id: 'communications', label: 'Communications', Icon: Fi.FiMail },
          ] },
        ];
      case 'helper':
        return [
          {
            id: 'helper',
            label: 'Current Retreat',
            Icon: Fi.FiActivity,
            items: [
              { id: 'current-retreat', label: 'EKG & BP Entry', Icon: Fi.FiActivity },
            ],
          },
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
  }, [navigationRole, permissionVersion]);

  const menuSections = useMemo(() => {
    const roleSections = getMenuSectionsForRole();
    if (appMode === 'shopping') {
      return [{
        id: 'shopping',
        label: 'Shopping',
        Icon: Fi.FiShoppingBag,
        items: [{ id: 'expenses', label: 'Receipts & expenses', Icon: Fi.FiCamera }],
      }];
    }
    if (appMode === 'retreat') {
      return [{
        id: 'retreat-mode',
        label: selectedRetreatLabel || 'This retreat',
        Icon: Fi.FiCalendar,
        items: [{ id: 'selected-retreat', label: 'Retreat dashboard', Icon: Fi.FiGrid }],
      }];
    }
    return roleSections;
  }, [appMode, getMenuSectionsForRole, selectedRetreatLabel]);

  const normalizedMenuSearch = menuSearch.trim().toLocaleLowerCase();
  const visibleMenuSections = useMemo(() => {
    if (!normalizedMenuSearch) return menuSections;

    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${item.label} ${item.id.replace(/-/g, ' ')}`
            .toLocaleLowerCase()
            .includes(normalizedMenuSearch)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [menuSections, normalizedMenuSearch]);

  const isExpanded = !isCollapsed;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayEmail = user?.email || '';
  const displayRole =
    navigationRole === 'admin' ? 'Administrator' :
    navigationRole === 'medical_staff' ? 'Medical Staff' :
    navigationRole === 'medical_advisor' ? 'Medical Advisor' :
    navigationRole === 'facilitator' ? 'Facilitator' :
    navigationRole === 'helper' ? 'Helper' :
    navigationRole === 'user' ? 'User' : 'User';

  useEffect(() => {
    let mounted = true;
    const loadNotificationCount = async () => {
      try {
        const response = await api.get('/submission-notifications/unread-count');
        if (mounted) setNotificationCount(Number(response.data?.count || 0));
      } catch {
        // Keep navigation usable if the count endpoint is temporarily unavailable.
      }
    };
    loadNotificationCount();
    const timer = window.setInterval(loadNotificationCount, 60000);
    window.addEventListener('notifications-updated', loadNotificationCount);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('notifications-updated', loadNotificationCount);
    };
  }, [activeItem]);

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
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          bg-white/80 backdrop-blur-xl
          border-r border-apple-gray-200
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isExpanded ? 'w-64' : 'w-20'}
        `}
      >
        <nav className="h-full flex flex-col">
          {/* Header */}
          <div className={`px-4 py-5 border-b border-apple-gray-100 ${!isExpanded && 'px-2 py-4'}`}>
            <div className="flex items-center justify-between">
              {/* Mobile close button */}
              <button
                className="md:hidden p-2 -ml-2 text-apple-gray-500 hover:text-apple-gray-700"
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
          <div className={`hidden md:block px-3 pt-4 pb-2 ${!isExpanded && 'px-2'}`}>
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
            {isExpanded && (
              <div className="px-3 pb-2">
                <label htmlFor="sidebar-menu-search" className="sr-only">
                  Search menu
                </label>
                <div className="relative">
                  {React.createElement(Fi.FiSearch as any, {
                    className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apple-gray-400",
                  })}
                  <input
                    id="sidebar-menu-search"
                    type="search"
                    value={menuSearch}
                    onChange={(event) => setMenuSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setMenuSearch('');
                    }}
                    placeholder="Filter menu..."
                    className="w-full rounded-apple border border-apple-gray-200 bg-white/80 py-2 pl-9 pr-8 text-sm text-apple-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  {menuSearch && (
                    <button
                      type="button"
                      onClick={() => setMenuSearch('')}
                      aria-label="Clear menu search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-apple-gray-400 hover:bg-apple-gray-100 hover:text-apple-gray-700"
                    >
                      {React.createElement(Fi.FiX as any, { className: "h-4 w-4" })}
                    </button>
                  )}
                </div>
              </div>
            )}
            <ul className={`px-3 space-y-1 ${!isExpanded && 'px-2'}`}>
              {visibleMenuSections.map((section) => {
                const sectionIsActive = section.items.some((item) => item.id === activeItem);
                const sectionIsOpen = Boolean(normalizedMenuSearch) || openSections[section.id] || sectionIsActive;
                const SectionIcon = section.Icon;
                const sectionTextColor = getTextColor(sectionIsActive);
                const sectionButton = (
                  <button
                    onClick={() => isExpanded ? toggleSection(section.id) : onItemClick(section.items[0]?.id || section.id)}
                    style={{
                      backgroundColor: 'transparent',
                      color: sectionTextColor,
                      borderColor: sectionIsActive ? 'rgba(17, 24, 39, 0.24)' : 'transparent',
                      borderWidth: '1px',
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-apple
                      transition-all duration-200 text-left
                      border hover:bg-transparent hover:border-apple-gray-300 hover:shadow-sm
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
                          const accent = BOOKING_STEP_NAV_ACCENTS[item.id];
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => {
                                  setMenuSearch('');
                                  onItemClick(item.id);
                                }}
                                style={{
                                  backgroundColor: accent ? (isActive ? accent.activeBackground : accent.background) : 'transparent',
                                  borderColor: accent ? accent.border : isActive ? 'rgba(17, 24, 39, 0.24)' : 'transparent',
                                  borderWidth: '1px',
                                  boxShadow: accent ? `inset 3px 0 0 ${accent.border}` : undefined,
                                }}
                                className={`
                                  w-full flex items-center gap-2 rounded-apple px-3 py-1.5 text-left
                                  transition-all duration-200
                                  border hover:bg-transparent hover:border-apple-gray-300 hover:shadow-sm
                                  ${isActive ? 'text-gray-950 shadow-none' : 'text-apple-gray-700 hover:text-apple-gray-950'}
                                `}
                              >
                                {React.createElement(IconComponent as any, {
                                  className: "w-4 h-4 flex-shrink-0",
                                  style: accent ? { color: accent.color } : undefined,
                                })}
                                <span className={`text-sm whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                  {item.label}
                                </span>
                                {item.id === 'ir-notifications' && notificationCount > 0 && (
                                  <span className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold text-white">
                                    {notificationCount > 99 ? '99+' : notificationCount}
                                  </span>
                                )}
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
            {isExpanded && normalizedMenuSearch && visibleMenuSections.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-apple-gray-500">
                No menu items found
              </p>
            )}
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
                    {displayName && (
                      <p className="text-sm font-medium text-apple-gray-800 truncate">
                        {displayName}
                      </p>
                    )}
                    {displayEmail && (
                      <p className="text-xs text-apple-gray-600 truncate">
                        {displayEmail}
                      </p>
                    )}
                    <p className="text-xs text-apple-gray-500 truncate">
                      {displayRole}
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
