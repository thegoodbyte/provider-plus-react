import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiBookOpen, FiCalendar, FiChevronDown, FiCreditCard, FiGrid, FiShoppingBag, FiUsers, FiX } from 'react-icons/fi';
import AppleSidebar from './AppleSidebar';
import UnifiedClientManager from './UnifiedClientManager';
import HousesGrid from './HousesGrid';
import RetreatsGrid from './RetreatsGrid';
import ScreeningClientsGrid from './ScreeningClientsGrid';
import ClientDetailsPage from './ClientDetailsPage';
import ClientEditPage from './ClientEditPage';
import AddClient from '../pages/AddClient';
import ClientScreening from '../pages/ClientScreening';
import RetreatDetailView, { RetreatDetailTab } from './RetreatDetailView';
// import ClientsGrid from './ClientsGrid'; // Now using UnifiedClientManager
import BookingsGrid from './BookingsGrid';
import BookingEditorPage from './BookingEditorPage';
import BookingDetailView from './BookingDetailView';
import CeremoniesPage from './CeremoniesPage';
import MedicalGrid from './MedicalGrid';
import MedicalTrackingNew from './MedicalTrackingNew';
import MedicalArtifactsPage from './MedicalArtifactsPage';
import MedicalArtifactCreatePage from './MedicalArtifactCreatePage';
import MedicalArtifactDetailPage from './MedicalArtifactDetailPage';
import MedicalArtifactFileViewPage from './MedicalArtifactFileViewPage';
import FileUploadsPage from './FileUploadsPage';
import MedicalTrackingCreatePage from './MedicalTrackingCreatePage';
import MedicalTrackingDetail from './MedicalTrackingDetail';
import MedicalTrackingEditPage from './MedicalTrackingEditPage';
import MedicalTrackingFileViewPage from './MedicalTrackingFileViewPage';
import WorkflowDashboard from './WorkflowDashboard';
import RetreatFlowPage from './RetreatFlowPage';
import RetreatFlowLibraryPage from './RetreatFlowLibraryPage';
import BookingFlowPage from './BookingFlowPage';
import NeedsAttentionPage from './NeedsAttentionPage';
import BookingDocumentsPage from './BookingDocumentsPage';
import BookingDocumentTypesPage from './BookingDocumentTypesPage';
import FlowTaskInboxPage from './FlowTaskInboxPage';
import MedicalReviewRequestsGrid from './MedicalReviewRequestsGrid';
import MedicalReviewRequestEditorPage from './MedicalReviewRequestEditorPage';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import MedicalReviewAccessPage from './MedicalReviewAccessPage';
import MedicalReviewGroupAccessPage from './MedicalReviewGroupAccessPage';
import MedicalReviewGroupPage from './MedicalReviewGroupPage';
import MedicalReviewPublicPage from './MedicalReviewPublicPage';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import PaymentEditorPage from './PaymentEditorPage';
import PaymentRequestsGrid from './PaymentRequestsGrid';
import PaymentRequestEditorPage from './PaymentRequestEditorPage';
import ExpensesPage from './ExpensesPage';
import ExpenseDetailPage from './ExpenseDetailPage';
import ExpenseEditorPage from './ExpenseEditorPage';
import CommunicationsPage from './CommunicationsPage';
import ContactBookPage from './ContactBookPage';
import ReferralsPage from './ReferralsPage';
import AssistantPage from './AssistantPage';
import HelperCurrentRetreatPage from './HelperCurrentRetreatPage';
import RetreatFocusModePage from './RetreatFocusModePage';
import RequirementsGrid from './RequirementsGrid';
import CurrencySettings from './CurrencySettings';
import MedicalAdvisorDashboard from './MedicalAdvisorDashboard';
import MedicalReviewDetail from './MedicalReviewDetail';
import MedicalRetreats from './MedicalRetreats';
import MedicalProfile from './MedicalProfile';
import MedicalClientView from './MedicalClientView';
import MedicalAdvisorReview from './MedicalAdvisorReview';
import ModuleLauncherPage from './ModuleLauncherPage';
import ReserveListsPage from './ReserveListsPage';
import ProtectedRoute from './ProtectedRoute';
import Unauthorized from './Unauthorized';
import PermissionsMatrix from './PermissionsMatrix';
import ClientMedicationsGrid from './ClientMedicationsGrid';
import ClientMedicationForm from './ClientMedicationForm';
import ClientFoodFormsPage from './ClientFoodFormsPage';
import BookingStepDeadlinesPage from './BookingStepDeadlinesPage';
import ScheduledRemindersPage from './ScheduledRemindersPage';
import MedicationStopPlanPage from './MedicationStopPlanPage';
import UserManagement from './UserManagement';
import AuditLogsPage from './AuditLogsPage';
import DataBackupPage from './DataBackupPage';
import { Tasks } from '../pages/Tasks/Tasks';
import { useAuth } from '../context/AuthContext';
import { ForgotPassword } from './Login/ForgotPassword';
import { ResetPassword } from './Login/ResetPassword';
import { ChangeOwnPassword } from './Login/ChangeOwnPassword';
import SubmissionNotificationsPage from './SubmissionNotificationsPage';
import RetreatClientsPrintPage from './RetreatClientsPrintPage';
import { bookingsApi, retreatsApi } from '../services/api';
import { Retreat } from '../types';

type AppMode = 'normal' | 'retreat' | 'shopping';
type StoredAppMode = {
  mode: AppMode;
  retreatId?: string;
  retreatLabel?: string;
};

const APP_MODE_STORAGE_KEY = 'providerPlusAppMode:v1';

const readStoredAppMode = (): StoredAppMode => {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_MODE_STORAGE_KEY) || '{}');
    if (parsed.mode === 'retreat' || parsed.mode === 'shopping') return parsed;
  } catch {
    // Ignore invalid or old local state.
  }
  return { mode: 'normal' };
};

const BookingDetailRoute: React.FC = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  return <BookingDetailView bookingId={bookingId || ''} onBack={() => navigate(-1)} />;
};

const RETREAT_DETAIL_TABS: RetreatDetailTab[] = ['clients', 'holisticView', 'tracking', 'drugScreening', 'expenses', 'payments', 'ceremonies', 'analytics', 'tasks'];

const getRetreatTabFromRoute = (tab?: string): RetreatDetailTab => (
  RETREAT_DETAIL_TABS.includes(tab as RetreatDetailTab) ? tab as RetreatDetailTab : 'clients'
);

const RetreatDetailRoute: React.FC = () => {
  const { retreatId, tab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const activeTab = getRetreatTabFromRoute(tab);

  return (
    <RetreatDetailView
      retreatId={retreatId || ''}
      initialTab={activeTab}
      onBack={() => navigate(`/${routePrefix}/retreats`)}
      onTabChange={(nextTab) => {
        const basePath = `/${routePrefix}/retreats/${retreatId}`;
        navigate(nextTab === 'clients' ? basePath : `${basePath}/${nextTab}`);
      }}
    />
  );
};

const HeaderIcon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => (
  <IconComponent className={className} />
);

const AppleLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [appMode, setAppMode] = useState<StoredAppMode>(readStoredAppMode);
  const [retreatOptions, setRetreatOptions] = useState<Retreat[]>([]);
  const [retreatsLoading, setRetreatsLoading] = useState(false);
  const [allowedBookingIds, setAllowedBookingIds] = useState<Set<string>>(new Set());
  const [allowedClientIds, setAllowedClientIds] = useState<Set<string>>(new Set());
  const [retreatAccessLoaded, setRetreatAccessLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const { logout, user, startMedicalStaffPreview, stopImpersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isMedicalAdvisor = user?.role === 'medical_advisor';
  const isMedicalQuickAccessSession = user?.accessType === 'medical_review_link' && Boolean(user?.medicalReviewRequestId);
  const showQuickMenu = !isMedicalAdvisor;

  const getActiveItemFromPath = () => {
    const path = location.pathname;

    // Handle prefixed routes (admin/, medical/, staff/, user/)
    const pathSegments = path.split('/').filter(Boolean);
    const route = pathSegments.length > 1 ? pathSegments[1] : pathSegments[0];

    // Map routes to sidebar items
    if (route === 'retreat') {
      const retreatSubRoute = pathSegments[3] || pathSegments[2];
      if (retreatSubRoute === 'ceremonies') return 'ceremonies';
      if (retreatSubRoute === 'bookings') return 'bookings';
      if (retreatSubRoute === 'houses') return 'houses';
      return 'retreats';
    }
    if (route === 'clients' || route === 'potential-clients') return 'clients';
    if (route === 'launcher') return 'launcher';
    if (route === 'current-retreat') return 'current-retreat';
    if (route === 'retreat-focus') return 'current-retreat';
    if (route === 'medical-dashboard') return 'medical-dashboard';
    if (route === 'medical-review') return 'medical-dashboard';
    if (route === 'medical-retreats') return 'medical-retreats';
    if (route === 'medical-artifacts') return 'medical-artifacts';
    if (route === 'medical-tracking') return 'medical-tracking';
    if (route === 'medical-review-requests') return 'medical-review-requests';
    if (route === 'review-requests') return 'review-requests';
    if (route === 'medical') return 'medical';
    if (route === 'client') return 'medical';
    if (route === 'workflow') return 'workflow';
    if (route === 'retreat-flow') return 'retreat-flow';
    if (route === 'retreat-flow-library') return 'retreat-flow-library';
    if (route === 'booking-flow') return 'booking-flow';
    if (route === 'booking-step-deadlines') return 'booking-step-deadlines';
    if (route === 'booking-documents') return 'booking-documents';
    if (route === 'booking-document-types') return 'booking-document-types';
    if (route === 'reserve-lists') return 'reserve-lists';
    if (route === 'flow-tasks') return 'flow-tasks';
    if (route === 'ir-notifications') return 'ir-notifications';
    if (route === 'retreats') return 'retreats';
    if (route === 'ceremonies') return 'ceremonies';
    if (route === 'houses') return 'houses';
    if (route === 'bookings') return 'bookings';
    if (route === 'reminders') return 'reminders';
    if (route === 'contact-book') return 'contact-book';
    if (route === 'referrals') return 'referrals';
    if (route === 'payments') return 'payments';
    if (route === 'payment-requests') return 'payment-requests';
    if (route === 'communications') return 'communications';
    if (route === 'assistant') return 'assistant';
    if (route === 'requirements') return 'requirements';
    if (route === 'analytics') return 'analytics';
    if (route === 'permissions') return 'permissions';
    if (route === 'users') return 'users';
    if (route === 'audit-logs') return 'audit-logs';
    if (route === 'tasks') return 'tasks';

    return getDefaultRoute();
  };

  const getDefaultRoute = () => {
    switch (user?.role) {
      case 'admin':
        return 'launcher';
      case 'medical_staff':
        return 'launcher';
      case 'medical_advisor':
        return 'medical-dashboard';
      case 'facilitator':
        return 'launcher';
      case 'helper':
        return 'current-retreat';
      default:
        return 'launcher';
    }
  };

  const getRoutePrefix = () => {
    switch (user?.role) {
      case 'admin':
        return 'admin';
      case 'medical_staff':
        return 'medical';
      case 'medical_advisor':
        return 'medical';
      case 'facilitator':
        return 'staff';
      case 'helper':
        return 'helper';
      case 'user':
        return 'user';
      default:
        return 'user';
    }
  };

  const activeItem = getActiveItemFromPath();
  const routePrefix = getRoutePrefix();
  const defaultRoute = getDefaultRoute();
  const isImpersonating = Boolean(user?.impersonatedBy || user?.originalRole);
  const isUserImpersonation = user?.impersonationType === 'user_impersonation';
  const impersonatedLabel = user?.impersonatedUserName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'user';
  const originalLabel = user?.impersonatedByEmail || user?.originalRole || 'admin';
  const userEmail = user?.email || '';
  const canChangeOwnPassword = Boolean(user) && !isImpersonating && !isMedicalQuickAccessSession;

  useEffect(() => {
    localStorage.setItem(APP_MODE_STORAGE_KEY, JSON.stringify(appMode));
  }, [appMode]);

  useEffect(() => {
    if (!quickMenuOpen || retreatOptions.length > 0 || retreatsLoading) return;
    setRetreatsLoading(true);
    retreatsApi.getAll()
      .then((response) => {
        const sorted = [...response.data].sort((a, b) => (
          new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
        ));
        setRetreatOptions(sorted);
      })
      .catch(() => setRetreatOptions([]))
      .finally(() => setRetreatsLoading(false));
  }, [quickMenuOpen, retreatOptions.length, retreatsLoading]);

  useEffect(() => {
    if (appMode.mode !== 'retreat' || !appMode.retreatId) {
      setAllowedBookingIds(new Set());
      setAllowedClientIds(new Set());
      setRetreatAccessLoaded(false);
      return;
    }
    setRetreatAccessLoaded(false);
    bookingsApi.getByRetreatWithDetails(appMode.retreatId)
      .then((response) => {
        const bookings = response.data || [];
        setAllowedBookingIds(new Set(bookings.map((booking: any) => String(booking._id))));
        setAllowedClientIds(new Set(bookings.map((booking: any) => {
          const client = booking.clientId;
          return String(typeof client === 'string' ? client : client?._id || '');
        }).filter(Boolean)));
      })
      .catch(() => {
        setAllowedBookingIds(new Set());
        setAllowedClientIds(new Set());
      })
      .finally(() => setRetreatAccessLoaded(true));
  }, [appMode.mode, appMode.retreatId]);

  useEffect(() => {
    if (isMedicalQuickAccessSession) {
      const allowedPath = `/medical/review-requests/${user.medicalReviewRequestId}/edit`;
      if (location.pathname !== allowedPath) {
        navigate(allowedPath, { replace: true });
      }
      return;
    }

    if (location.pathname === '/') {
      navigate(`/${routePrefix}/${defaultRoute}`, { replace: true });
    }
  }, [defaultRoute, isMedicalQuickAccessSession, location.pathname, navigate, routePrefix, user?.medicalReviewRequestId]);

  useEffect(() => {
    if (isMedicalQuickAccessSession || appMode.mode === 'normal') return;
    const prefix = `/${routePrefix}`;
    const path = location.pathname;

    if (appMode.mode === 'shopping') {
      if (path !== `${prefix}/expenses` && !path.startsWith(`${prefix}/expenses/`)) navigate(`${prefix}/expenses`, { replace: true });
      return;
    }

    if (!appMode.retreatId) {
      setAppMode({ mode: 'normal' });
      return;
    }
    if (!retreatAccessLoaded) return;

    const retreatRoot = `${prefix}/retreats/${appMode.retreatId}`;
    const bookingMatch = path.match(new RegExp(`^${prefix}/bookings/([^/]+)`));
    const clientMatch = path.match(new RegExp(`^${prefix}/(?:clients|medical)/([^/]+)`));
    const isSelectedRetreat = path === retreatRoot || path.startsWith(`${retreatRoot}/`);
    const isAllowedBooking = Boolean(bookingMatch && allowedBookingIds.has(bookingMatch[1]));
    const isAllowedClient = Boolean(clientMatch && allowedClientIds.has(clientMatch[1]));

    if (!isSelectedRetreat && !isAllowedBooking && !isAllowedClient) {
      navigate(retreatRoot, { replace: true });
    }
  }, [
    allowedBookingIds,
    allowedClientIds,
    appMode,
    isMedicalQuickAccessSession,
    location.pathname,
    navigate,
    retreatAccessLoaded,
    routePrefix,
  ]);

  const handleItemClick = (item: string) => {
    const prefix = getRoutePrefix();
    if (item === 'selected-retreat' && appMode.retreatId) {
      navigate(`/${prefix}/retreats/${appMode.retreatId}`);
      setSidebarOpen(false);
      return;
    }
    const retreatSectionRoutes: Record<string, string> = {
      ceremonies: 'retreat/ceremonies',
      bookings: 'retreat/bookings',
      houses: 'retreat/houses',
    };
    navigate(`/${prefix}/${retreatSectionRoutes[item] || item}`);
    setSidebarOpen(false);
  };

  const quickMenuItems = [
    { label: 'Clients', route: 'clients', icon: FiUsers },
    { label: 'Retreats', route: 'retreats', icon: FiCalendar },
    { label: 'Bookings', route: 'bookings', icon: FiBookOpen },
    { label: 'Payments', route: 'payments', icon: FiCreditCard },
  ];

  const handleQuickMenuClick = (route: string) => {
    navigate(`/${getRoutePrefix()}/${route}`);
    setQuickMenuOpen(false);
  };

  const activateNormalMode = () => {
    setAppMode({ mode: 'normal' });
    setQuickMenuOpen(false);
    navigate(`/${getRoutePrefix()}/${getDefaultRoute()}`);
  };

  const activateShoppingMode = () => {
    setAppMode({ mode: 'shopping' });
    setQuickMenuOpen(false);
    setSidebarOpen(false);
    navigate(`/${getRoutePrefix()}/expenses`);
  };

  const activateRetreatMode = (retreat: Retreat) => {
    const retreatLabel = String(retreat.code || retreat.retreatCode || retreat.name || 'Retreat');
    setAppMode({ mode: 'retreat', retreatId: retreat._id, retreatLabel });
    setQuickMenuOpen(false);
    setSidebarOpen(false);
    navigate(`/${getRoutePrefix()}/retreats/${retreat._id}`);
  };

  useEffect(() => {
    if (!showQuickMenu && quickMenuOpen) {
      setQuickMenuOpen(false);
    }
  }, [showQuickMenu, quickMenuOpen]);

  const renderQuickMenu = () => {
    if (!showQuickMenu) return null;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setQuickMenuOpen((open) => !open)}
          className="inline-flex min-h-11 items-center gap-2 rounded-apple border border-apple-gray-200 bg-white px-3 py-2 text-sm font-semibold text-apple-gray-700 shadow-apple-sm transition-colors hover:bg-apple-gray-50"
          aria-expanded={quickMenuOpen}
          aria-controls="quick-menu"
        >
          {appMode.mode === 'normal' ? 'Quick Menu' : appMode.mode === 'shopping' ? 'Shopping Mode' : appMode.retreatLabel || 'Retreat Mode'}
          <HeaderIcon
            icon={FiChevronDown}
            className={`h-4 w-4 transition-transform ${quickMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {quickMenuOpen && (
          <div
            id="quick-menu"
            className="fixed inset-3 z-50 overflow-y-auto rounded-apple-lg border border-apple-gray-200 bg-white p-4 shadow-apple-lg md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-[520px]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-apple-gray-900">Choose app mode</div>
                <div className="text-sm text-apple-gray-600">Large, simple controls for this device.</div>
              </div>
              <button type="button" onClick={() => setQuickMenuOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-apple-gray-100" aria-label="Close quick menu">
                <HeaderIcon icon={FiX} className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={activateNormalMode} className={`min-h-28 rounded-2xl border-2 p-4 text-left ${appMode.mode === 'normal' ? 'border-blue-600 bg-blue-50' : 'border-apple-gray-200'}`}>
                <HeaderIcon icon={FiGrid} className="mb-3 h-8 w-8 text-blue-700" />
                <div className="font-bold">Normal</div>
                <div className="text-xs text-apple-gray-600">Full app</div>
              </button>
              <button type="button" onClick={activateShoppingMode} className={`min-h-28 rounded-2xl border-2 p-4 text-left ${appMode.mode === 'shopping' ? 'border-emerald-600 bg-emerald-50' : 'border-apple-gray-200'}`}>
                <HeaderIcon icon={FiShoppingBag} className="mb-3 h-8 w-8 text-emerald-700" />
                <div className="font-bold">Shopping</div>
                <div className="text-xs text-apple-gray-600">Receipts & expenses</div>
              </button>
              <div className={`min-h-28 rounded-2xl border-2 p-4 ${appMode.mode === 'retreat' ? 'border-violet-600 bg-violet-50' : 'border-apple-gray-200'}`}>
                <HeaderIcon icon={FiCalendar} className="mb-3 h-8 w-8 text-violet-700" />
                <div className="font-bold">Retreat</div>
                <div className="text-xs text-apple-gray-600">One retreat only</div>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="mode-retreat-picker" className="mb-2 block text-sm font-bold text-apple-gray-800">Start Retreat Mode</label>
              <select
                id="mode-retreat-picker"
                value={appMode.mode === 'retreat' ? appMode.retreatId || '' : ''}
                onChange={(event) => {
                  const retreat = retreatOptions.find((item) => item._id === event.target.value);
                  if (retreat) activateRetreatMode(retreat);
                }}
                disabled={retreatsLoading}
                className="min-h-14 w-full rounded-xl border-2 border-apple-gray-300 bg-white px-4 text-base font-semibold"
              >
                <option value="">{retreatsLoading ? 'Loading retreats…' : 'Select a retreat…'}</option>
                {retreatOptions.map((retreat) => (
                  <option key={retreat._id} value={retreat._id}>
                    {String(retreat.code || retreat.retreatCode || retreat.name)}{retreat.startDate ? ` — ${new Date(retreat.startDate).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {appMode.mode === 'normal' && (
              <div className="mt-5 border-t border-apple-gray-200 pt-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-apple-gray-500">Quick links</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {quickMenuItems.map((item) => (
                    <button key={item.route} type="button" onClick={() => handleQuickMenuClick(item.route)} className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-apple-gray-200 bg-white p-2 font-semibold text-apple-gray-700">
                      <HeaderIcon icon={item.icon} className="mb-1 h-7 w-7" />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  // Listen for storage changes to sync sidebar state
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebarCollapsed');
      setSidebarCollapsed(saved === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('sidebarCollapsedChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarCollapsedChange', handleStorageChange);
    };
  }, []);

  if (isMedicalQuickAccessSession) {
    return (
      <div className="min-h-screen bg-apple-gray-50">
        <header className="sticky top-0 z-30 border-b border-apple-gray-200 bg-white/90 backdrop-blur-apple">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Medical quick access</div>
              <h1 className="text-lg font-semibold text-apple-gray-900">Provider Plus medical review</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="max-w-64 truncate text-apple-gray-600" title={userEmail}>
                {userEmail}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-apple border border-apple-gray-200 bg-white px-3 py-1.5 font-medium text-apple-gray-700 hover:bg-apple-gray-50"
              >
                Login here to access your full profile
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-73px)] px-3 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-apple-lg bg-white shadow-apple-sm">
            <Routes>
              <Route path="/medical/review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
              <Route path="/medical/review-requests/:id" element={<MedicalReviewRequestsPage />} />
              <Route path="/medical-review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
              <Route path="/medical-review-requests/:id" element={<MedicalReviewRequestsPage />} />
              <Route path="*" element={<MedicalReviewRequestsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-gray-50">
      {/* Sidebar */}
      <AppleSidebar
        activeItem={appMode.mode === 'retreat' ? 'selected-retreat' : activeItem}
        onItemClick={handleItemClick}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        userRole={user?.role}
        user={user}
        appMode={appMode.mode}
        selectedRetreatLabel={appMode.retreatLabel}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Mobile floating controls keep navigation available without reserving header space. */}
        <div className="fixed left-4 right-4 top-4 z-40 flex items-center justify-between md:hidden pointer-events-none">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-apple-gray-700 shadow-apple-sm backdrop-blur-apple transition-colors hover:bg-white"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="pointer-events-auto">
              {renderQuickMenu()}
            </div>
            {canChangeOwnPassword && (
              <button
                onClick={() => navigate('/users/change-password')}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-apple-gray-700 shadow-apple-sm backdrop-blur-apple transition-colors hover:bg-white"
                aria-label="Change password"
                title="Change password"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H3v-4.586l5.257-5.257A6 6 0 1121 9z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-apple-gray-700 shadow-apple-sm backdrop-blur-apple transition-colors hover:bg-white"
              aria-label="Currency converter"
              title="Revolut currency converter"
            >
              <span className="text-lg font-bold" aria-hidden="true">$↔</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-apple-gray-700 shadow-apple-sm backdrop-blur-apple transition-colors hover:bg-white"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {appMode.mode !== 'normal' && (
          <div className={`sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold md:top-14 ${
            appMode.mode === 'shopping' ? 'bg-emerald-100 text-emerald-950' : 'bg-violet-100 text-violet-950'
          }`}>
            <span className="truncate">
              {appMode.mode === 'shopping' ? 'Shopping Mode · Receipts & expenses only' : `Retreat Mode · ${appMode.retreatLabel || 'Selected retreat'}`}
            </span>
            <button type="button" onClick={() => setQuickMenuOpen(true)} className="min-h-10 shrink-0 rounded-lg bg-white px-3 shadow-sm">
              Switch
            </button>
          </div>
        )}

        {/* Header with glass morphism */}
        <header className="sticky top-0 z-30 hidden bg-white/70 backdrop-blur-apple border-b border-apple-gray-200 md:block">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-apple hover:bg-apple-gray-100 transition-colors flex-shrink-0"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-apple-gray-900 tracking-tight">
                  Provider Plus
                </h1>
                {renderQuickMenu()}
              </div>

                {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className="inline-flex items-center gap-2 rounded-apple bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  aria-label="Currency converter"
                  title="Revolut currency converter"
                >
                  <span aria-hidden="true">$↔</span>
                  <span>Currency</span>
                </button>
                {user?.role === 'admin' && !isImpersonating && (
                  <button
                    onClick={async () => {
                      await startMedicalStaffPreview();
                      navigate('/medical/launcher');
                    }}
                    className="hidden md:inline-flex px-3 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-apple transition-all"
                  >
                    Medical View
                  </button>
                )}
                {isImpersonating && (
                  <button
                    onClick={() => {
                      stopImpersonation();
                      navigate('/admin/launcher');
                    }}
                    className="hidden md:inline-flex px-3 py-1.5 text-sm font-medium text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-apple transition-all"
                  >
                    {isUserImpersonation ? 'Return to Admin' : 'Exit Medical View'}
                  </button>
                )}
                {/* Settings button */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-apple hover:bg-apple-gray-100 transition-colors"
                  aria-label="Settings"
                >
                  <svg className="w-5 h-5 text-apple-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* User menu */}
                <div className="hidden sm:flex items-center gap-2">
                  {userEmail && (
                    <span className="max-w-48 truncate text-xs font-medium text-apple-gray-600" title={userEmail}>
                      {userEmail}
                    </span>
                  )}
                  {canChangeOwnPassword && (
                    <button
                      onClick={() => navigate('/users/change-password')}
                      className="inline-flex px-3 py-1.5 text-sm font-medium text-apple-gray-600 hover:text-apple-gray-900
                               bg-apple-gray-100 hover:bg-apple-gray-200 rounded-apple transition-all"
                    >
                      Change Password
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="inline-flex px-3 py-1.5 text-sm font-medium text-apple-gray-600 hover:text-apple-gray-900
                             bg-apple-gray-100 hover:bg-apple-gray-200 rounded-apple transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {isImpersonating && (
          <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isUserImpersonation
                ? `Impersonating ${impersonatedLabel}. Original admin: ${originalLabel}. This session is audited.`
                : 'Previewing the medical staff view as an admin. This session is audited and intended for read-only verification.'}
            </span>
            <button
              type="button"
              onClick={() => {
                stopImpersonation();
                navigate('/admin/launcher');
              }}
              className="w-fit rounded-apple border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              {isUserImpersonation ? 'Return to Admin' : 'Exit Medical View'}
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="h-[calc(100vh-32px)] overflow-y-auto px-4 py-4 sm:px-6 lg:h-[calc(100vh-64px-32px)] lg:px-8 lg:py-6">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-apple-lg shadow-apple-sm">
              <Routes>
                {/* Unauthorized route */}
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/medical/review-link/:token" element={<MedicalReviewPublicPage />} />
                <Route path="/medical-review-access/:token/:label" element={<MedicalReviewAccessPage />} />
                <Route path="/medical-review-access/:token" element={<MedicalReviewAccessPage />} />
                <Route path="/medical-review-group-access/:token" element={<MedicalReviewGroupAccessPage />} />
                <Route path="/users/forgot-password" element={<ForgotPassword />} />
                <Route path="/users/forgot-pasword" element={<ForgotPassword />} />
                <Route path="/users/change-password/:token" element={<ResetPassword />} />
                <Route path="/users/change-password" element={<ProtectedRoute><ChangeOwnPassword /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/admin/*" element={
                  <ProtectedRoute requiredRole={['admin']}>
                    <Routes>
                      <Route index element={<ModuleLauncherPage />} />
                      <Route path="launcher" element={<ModuleLauncherPage />} />
                      <Route path="clients" element={<UnifiedClientManager />} />
                      <Route path="clients/add" element={<AddClient />} />
                      <Route path="clients/:clientId" element={<ClientDetailsPage />} />
                      <Route path="clients/:clientId/edit" element={<ClientEditPage />} />
                      <Route path="clients/:clientId/screening" element={<ClientScreening />} />
                      <Route path="screening" element={<ScreeningClientsGrid />} />
                      <Route path="potential-clients" element={<UnifiedClientManager />} />
                      <Route path="retreats" element={<RetreatsGrid />} />
                      <Route path="retreats/:retreatId/clients-print" element={<RetreatClientsPrintPage />} />
                      <Route path="retreats/:retreatId" element={<RetreatDetailRoute />} />
                      <Route path="retreats/:retreatId/:tab" element={<RetreatDetailRoute />} />
                      <Route path="retreat/:retreatId" element={<RetreatDetailRoute />} />
                      <Route path="retreat/:retreatId/:tab" element={<RetreatDetailRoute />} />
                      <Route path="retreat/ceremonies" element={<CeremoniesPage />} />
                      <Route path="retreat/bookings" element={<BookingsGrid />} />
                      <Route path="retreat/houses" element={<HousesGrid />} />
                      <Route path="retreat-focus" element={<RetreatFocusModePage />} />
                      <Route path="ceremonies" element={<CeremoniesPage />} />
                      <Route path="houses" element={<HousesGrid />} />
                      <Route path="bookings" element={<BookingsGrid />} />
                      <Route path="bookings/new" element={<BookingEditorPage mode="create" />} />
                      <Route path="bookings/:bookingId" element={<BookingDetailRoute />} />
                      <Route path="bookings/:bookingId/edit" element={<BookingEditorPage mode="edit" />} />
                      <Route path="medical-tracking" element={<MedicalTrackingNew />} />
                      <Route path="medical-artifacts" element={<MedicalArtifactsPage />} />
                      <Route path="medical-artifacts/new" element={<MedicalArtifactCreatePage />} />
                      <Route path="medical-artifacts/:id" element={<MedicalArtifactDetailPage />} />
                      <Route path="medical-artifacts/:id/edit" element={<MedicalArtifactDetailPage />} />
                      <Route path="medical-artifacts/:id/files/:fileIndex" element={<MedicalArtifactFileViewPage />} />
                      <Route path="file-uploads" element={<FileUploadsPage />} />
                      <Route path="medical-tracking/new" element={<MedicalTrackingCreatePage />} />
                      <Route path="medical-tracking/:id" element={<MedicalTrackingDetail />} />
                      <Route path="medical-tracking/:id/edit" element={<MedicalTrackingEditPage />} />
                      <Route path="medical-tracking/:id/view/:type" element={<MedicalTrackingFileViewPage />} />
                      <Route path="medical-review-requests" element={<MedicalReviewRequestsGrid />} />
                      <Route path="medical-review-requests/new" element={<MedicalReviewRequestEditorPage />} />
                      <Route path="medical-review-requests/:id" element={<MedicalReviewRequestsPage />} />
                      <Route path="medical-review-requests/:id/edit" element={<MedicalReviewRequestEditorPage />} />
                      <Route path="medical-review-requests/*" element={<MedicalReviewRequestsPage />} />
                      <Route path="workflow" element={<WorkflowDashboard />} />
                      <Route path="workflow/bookings/:bookingId" element={<WorkflowDashboard />} />
                      <Route path="retreat-flow" element={<RetreatFlowPage />} />
                      <Route path="retreat-flow/:retreatId" element={<RetreatFlowPage />} />
                      <Route path="retreat-flow-library" element={<RetreatFlowLibraryPage />} />
                      <Route path="scheduled-reminders" element={<ScheduledRemindersPage />} />
                      <Route path="booking-step-deadlines" element={<BookingStepDeadlinesPage />} />
                      <Route path="bookings/:bookingId/medication-stop-plan" element={<MedicationStopPlanPage />} />
                      <Route path="booking-flow" element={<BookingFlowPage />} />
                      <Route path="booking-flow/:bookingId" element={<BookingFlowPage />} />
                      <Route path="needs-attention" element={<NeedsAttentionPage />} />
                      <Route path="ir-notifications" element={<SubmissionNotificationsPage />} />
                      <Route path="booking-documents" element={<BookingDocumentsPage />} />
                      <Route path="booking-document-types" element={<BookingDocumentTypesPage />} />
                      <Route path="reserve-lists" element={<ReserveListsPage />} />
                      <Route path="flow-tasks" element={<FlowTaskInboxPage />} />
                      <Route path="medical-dashboard" element={<MedicalAdvisorDashboard />} />
                      <Route path="medical-review/:bookingId" element={<MedicalReviewDetail />} />
                      <Route path="medical-retreats" element={<MedicalRetreats />} />
                      <Route path="medical/:clientId" element={<MedicalProfile />} />
                      <Route path="client/:clientId" element={<MedicalClientView />} />
                      <Route path="medical" element={<MedicalGrid />} />
                      <Route path="reminders" element={<RemindersPage />} />
                      <Route path="payments" element={<PaymentsPage />} />
                      <Route path="payments/new" element={<PaymentEditorPage />} />
                      <Route path="payments/:id" element={<PaymentEditorPage />} />
                      <Route path="payments/:id/edit" element={<PaymentEditorPage />} />
                      <Route path="expenses" element={<ExpensesPage />} />
                      <Route path="expenses/new" element={<ExpenseEditorPage />} />
                      <Route path="expenses/:id" element={<ExpenseDetailPage />} />
                      <Route path="expenses/:id/edit" element={<ExpenseEditorPage />} />
                      <Route path="payment-requests" element={<PaymentRequestsGrid />} />
                      <Route path="payment-requests/new" element={<PaymentRequestEditorPage />} />
                      <Route path="payment-requests/:id" element={<PaymentRequestEditorPage />} />
                      <Route path="payment-requests/:id/edit" element={<PaymentRequestEditorPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                      <Route path="assistant" element={<AssistantPage />} />
                      <Route path="contact-book" element={<ContactBookPage />} />
                      <Route path="referrals" element={<ReferralsPage />} />
                      <Route path="requirements" element={<RequirementsGrid />} />
                      <Route path="permissions" element={<PermissionsMatrix />} />
                      <Route path="client-medications" element={<ClientMedicationsGrid />} />
                      <Route path="client-medications/create" element={<ClientMedicationForm mode="create" />} />
                      <Route path="client-medications/edit/:id" element={<ClientMedicationForm mode="edit" />} />
                      <Route path="client-medications/view/:id" element={<ClientMedicationForm mode="view" />} />
                      <Route path="client-food-forms" element={<ClientFoodFormsPage />} />
                      <Route path="analytics" element={<div className="p-6">Analytics - Coming Soon</div>} />
                      <Route path="users" element={<UserManagement />} />
                      <Route path="audit-logs" element={<AuditLogsPage />} />
                      <Route path="backups" element={<DataBackupPage />} />
                      <Route path="tasks" element={<Tasks />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* Medical staff routes */}
                <Route path="/medical/*" element={
                  <ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}>
                    {isMedicalAdvisor ? (
                      <Routes>
                        <Route index element={<MedicalAdvisorDashboard />} />
                        <Route path="launcher" element={<MedicalAdvisorDashboard />} />
                        <Route path="dashboard" element={<MedicalAdvisorDashboard />} />
                        <Route path="medical-dashboard" element={<MedicalAdvisorDashboard />} />
                        <Route path="review-requests" element={<MedicalReviewRequestsGrid />} />
                        <Route path="review-requests/new" element={<Unauthorized />} />
                        <Route path="review-requests/:id" element={<MedicalReviewRequestsPage />} />
                        <Route path="review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
                        <Route path="review-groups/:id" element={<MedicalReviewGroupPage />} />
                        <Route path="medical-review-requests" element={<MedicalReviewRequestsGrid />} />
                        <Route path="medical-review-requests/new" element={<Unauthorized />} />
                        <Route path="medical-review-requests/:id" element={<MedicalReviewRequestsPage />} />
                        <Route path="medical-review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
                        <Route path="*" element={<Unauthorized />} />
                      </Routes>
                    ) : (
                      <Routes>
                        <Route index element={<MedicalReviewRequestsGrid />} />
                        <Route path="launcher" element={<ModuleLauncherPage />} />
                        <Route path="dashboard" element={<MedicalAdvisorDashboard />} />
                        <Route path="medical-dashboard" element={<MedicalAdvisorDashboard />} />
                        <Route path="tracking" element={<MedicalTrackingNew />} />
                        <Route path="medical-tracking" element={<MedicalTrackingNew />} />
                        <Route path="medical-artifacts" element={<MedicalArtifactsPage />} />
                        <Route path="medical-artifacts/new" element={<MedicalArtifactCreatePage />} />
                        <Route path="medical-artifacts/:id" element={<MedicalArtifactDetailPage />} />
                        <Route path="medical-artifacts/:id/edit" element={<MedicalArtifactDetailPage />} />
                        <Route path="medical-artifacts/:id/files/:fileIndex" element={<MedicalArtifactFileViewPage />} />
                        <Route path="file-uploads" element={<FileUploadsPage />} />
                        <Route path="medical-tracking/new" element={<MedicalTrackingCreatePage />} />
                        <Route path="tracking/:id" element={<MedicalTrackingDetail />} />
                        <Route path="medical-tracking/:id" element={<MedicalTrackingDetail />} />
                        <Route path="medical-tracking/:id/edit" element={<MedicalTrackingEditPage />} />
                        <Route path="medical-tracking/:id/view/:type" element={<MedicalTrackingFileViewPage />} />
                        <Route path="review-requests" element={<MedicalReviewRequestsGrid />} />
                        <Route path="review-requests/new" element={<MedicalReviewRequestEditorPage />} />
                        <Route path="review-requests/:id" element={<MedicalReviewRequestsPage />} />
                        <Route path="review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
                        <Route path="review-groups/:id" element={<MedicalReviewGroupPage />} />
                        <Route path="medical-review-requests" element={<MedicalReviewRequestsGrid />} />
                        <Route path="medical-review-requests/new" element={<MedicalReviewRequestEditorPage />} />
                        <Route path="medical-review-requests/:id" element={<MedicalReviewRequestsPage />} />
                        <Route path="medical-review-requests/:id/edit" element={<MedicalReviewRequestsPage />} />
                        <Route path="workflow" element={<WorkflowDashboard />} />
                        <Route path="workflow/bookings/:bookingId" element={<WorkflowDashboard />} />
                        <Route path="retreat-flow" element={<RetreatFlowPage />} />
                        <Route path="retreat-flow/:retreatId" element={<RetreatFlowPage />} />
                        <Route path="retreat-flow-library" element={<RetreatFlowLibraryPage />} />
                        <Route path="scheduled-reminders" element={<ScheduledRemindersPage />} />
                        <Route path="booking-step-deadlines" element={<BookingStepDeadlinesPage />} />
                        <Route path="bookings/:bookingId/medication-stop-plan" element={<MedicationStopPlanPage />} />
                        <Route path="booking-flow" element={<BookingFlowPage />} />
                        <Route path="booking-flow/:bookingId" element={<BookingFlowPage />} />
                        <Route path="needs-attention" element={<NeedsAttentionPage />} />
                        <Route path="ir-notifications" element={<SubmissionNotificationsPage />} />
                        <Route path="booking-documents" element={<BookingDocumentsPage />} />
                        <Route path="booking-document-types" element={<BookingDocumentTypesPage />} />
                        <Route path="reserve-lists" element={<ReserveListsPage />} />
                        <Route path="flow-tasks" element={<FlowTaskInboxPage />} />
                        <Route path="review/:id" element={<MedicalAdvisorReview />} />
                        <Route path="medical-review/:id" element={<MedicalAdvisorReview />} />
                        <Route path="medical-review/:bookingId" element={<MedicalReviewDetail />} />
                        <Route path="medical-retreats" element={<MedicalRetreats />} />
                        <Route path="clients" element={<UnifiedClientManager />} />
                        <Route path="clients/add" element={<AddClient />} />
                        <Route path="potential-clients" element={<UnifiedClientManager />} />
                        <Route path="client/:clientId" element={<MedicalProfile />} />
                        <Route path="bookings" element={<BookingsGrid />} />
                        <Route path="bookings/new" element={<BookingEditorPage mode="create" />} />
                        <Route path="bookings/:bookingId" element={<BookingDetailRoute />} />
                        <Route path="bookings/:bookingId/edit" element={<BookingEditorPage mode="edit" />} />
                        <Route path="retreats" element={<RetreatsGrid />} />
                        <Route path="retreats/:retreatId/clients-print" element={<RetreatClientsPrintPage />} />
                        <Route path="retreats/:retreatId" element={<RetreatDetailRoute />} />
                        <Route path="retreats/:retreatId/:tab" element={<RetreatDetailRoute />} />
                        <Route path="retreat/:retreatId" element={<RetreatDetailRoute />} />
                        <Route path="retreat/:retreatId/:tab" element={<RetreatDetailRoute />} />
                        <Route path="retreat/ceremonies" element={<CeremoniesPage />} />
                        <Route path="retreat/bookings" element={<BookingsGrid />} />
                        <Route path="retreat-focus" element={<RetreatFocusModePage />} />
                        <Route path="ceremonies" element={<CeremoniesPage />} />
                        <Route path="reminders" element={<RemindersPage />} />
                        <Route path="contact-book" element={<ContactBookPage />} />
                        <Route path="communications" element={<CommunicationsPage />} />
                        <Route path="assistant" element={<AssistantPage />} />
                      </Routes>
                    )}
                  </ProtectedRoute>
                } />

                {/* Helper routes */}
                <Route path="/helper/*" element={
                  <ProtectedRoute requiredRole={['helper', 'admin']}>
                    <Routes>
                      <Route index element={<HelperCurrentRetreatPage />} />
                      <Route path="current-retreat" element={<HelperCurrentRetreatPage />} />
                      <Route path="retreat-focus" element={<RetreatFocusModePage />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* Staff/Facilitator routes */}
                <Route path="/staff/*" element={
                  <ProtectedRoute requiredRole={['facilitator', 'medical_staff', 'admin']}>
                    <Routes>
                      <Route index element={<ModuleLauncherPage />} />
                      <Route path="launcher" element={<ModuleLauncherPage />} />
                      <Route path="bookings" element={<BookingsGrid />} />
                      <Route path="retreats" element={<RetreatsGrid />} />
                      <Route path="retreats/:retreatId/clients-print" element={<RetreatClientsPrintPage />} />
                      <Route path="retreats/:retreatId" element={<RetreatDetailRoute />} />
                      <Route path="retreats/:retreatId/:tab" element={<RetreatDetailRoute />} />
                      <Route path="retreat/:retreatId" element={<RetreatDetailRoute />} />
                      <Route path="retreat/:retreatId/:tab" element={<RetreatDetailRoute />} />
                      <Route path="retreat/ceremonies" element={<CeremoniesPage />} />
                      <Route path="retreat/bookings" element={<BookingsGrid />} />
                      <Route path="retreat/houses" element={<HousesGrid />} />
                      <Route path="retreat-focus" element={<RetreatFocusModePage />} />
                      <Route path="ceremonies" element={<CeremoniesPage />} />
                      <Route path="houses" element={<HousesGrid />} />
                      <Route path="clients" element={<UnifiedClientManager />} />
                      <Route path="clients/add" element={<AddClient />} />
                      <Route path="potential-clients" element={<UnifiedClientManager />} />
                      <Route path="reminders" element={<RemindersPage />} />
                      <Route path="contact-book" element={<ContactBookPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* User routes */}
                <Route path="/user/*" element={
                  <ProtectedRoute requiredRole={['user', 'facilitator', 'medical_staff', 'admin']}>
                    <Routes>
                      <Route index element={<ModuleLauncherPage />} />
                      <Route path="launcher" element={<ModuleLauncherPage />} />
                      <Route path="clients" element={<UnifiedClientManager />} />
                      <Route path="clients/add" element={<AddClient />} />
                      <Route path="retreat-focus" element={<RetreatFocusModePage />} />
                      <Route path="reminders" element={<RemindersPage />} />
                      <Route path="contact-book" element={<ContactBookPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* Legacy routes for backwards compatibility - redirect to appropriate prefixed routes */}
                <Route path="/medical-dashboard" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalAdvisorDashboard /></ProtectedRoute>} />
                <Route path="/launcher" element={<ProtectedRoute>{isMedicalAdvisor ? <MedicalAdvisorDashboard /> : <ModuleLauncherPage />}</ProtectedRoute>} />
                <Route path="/medical-review/:bookingId" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalReviewDetail /></ProtectedRoute>} />
                <Route path="/medical-retreats" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalRetreats /></ProtectedRoute>} />
                <Route path="/medical-tracking" element={<ProtectedRoute><MedicalTrackingNew /></ProtectedRoute>} />
                <Route path="/medical-tracking/new" element={<ProtectedRoute><MedicalTrackingCreatePage /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id" element={<ProtectedRoute><MedicalTrackingDetail /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id/edit" element={<ProtectedRoute><MedicalTrackingEditPage /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id/view/:type" element={<ProtectedRoute><MedicalTrackingFileViewPage /></ProtectedRoute>} />
                <Route path="/medical-artifacts/:id" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalArtifactDetailPage /></ProtectedRoute>} />
                <Route path="/medical-artifacts/:id/edit" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalArtifactDetailPage /></ProtectedRoute>} />
                <Route path="/medical-artifacts/:id/files/:fileIndex" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalArtifactFileViewPage /></ProtectedRoute>} />
                <Route path="/file-uploads" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><FileUploadsPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/medical-review-requests/new" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/:id" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/:id/edit" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/*" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/medical/client/:clientId" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalClientView /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests" element={<ProtectedRoute><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/new" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/:id" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/:id/edit" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/admin/medical-review-groups/:id" element={<ProtectedRoute requiredRole={['admin', 'medical_staff']}><MedicalReviewGroupPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests/new" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests/:id" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests/:id/edit" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical/review-groups/:id" element={<ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}><MedicalReviewGroupPage /></ProtectedRoute>} />
                <Route path="/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/admin/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/medical/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute requiredRole={['admin', 'medical_staff']}><AssistantPage /></ProtectedRoute>} />
                <Route path="/admin/assistant" element={<ProtectedRoute requiredRole={['admin']}><AssistantPage /></ProtectedRoute>} />
                <Route path="/medical/assistant" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><AssistantPage /></ProtectedRoute>} />
                <Route path="/contact-book" element={<ProtectedRoute><ContactBookPage /></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute requiredRole={['admin']}><ReferralsPage /></ProtectedRoute>} />
                <Route path="/admin/referrals" element={<ProtectedRoute requiredRole={['admin']}><ReferralsPage /></ProtectedRoute>} />
                <Route path="/admin/contact-book" element={<ProtectedRoute><ContactBookPage /></ProtectedRoute>} />
                <Route path="/medical/contact-book" element={<ProtectedRoute><ContactBookPage /></ProtectedRoute>} />
                <Route path="/staff/contact-book" element={<ProtectedRoute><ContactBookPage /></ProtectedRoute>} />
                <Route path="/user/contact-book" element={<ProtectedRoute><ContactBookPage /></ProtectedRoute>} />
                <Route path="/admin/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/medical/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/staff/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/user/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/workflow" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><WorkflowDashboard /></ProtectedRoute>} />
                <Route path="/workflow/bookings/:bookingId" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><WorkflowDashboard /></ProtectedRoute>} />
                <Route path="/retreat-flow" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><RetreatFlowPage /></ProtectedRoute>} />
                <Route path="/retreat-flow/:retreatId" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><RetreatFlowPage /></ProtectedRoute>} />
                <Route path="/retreat-flow-library" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><RetreatFlowLibraryPage /></ProtectedRoute>} />
                <Route path="/booking-flow" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><BookingFlowPage /></ProtectedRoute>} />
                <Route path="/booking-flow/:bookingId" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><BookingFlowPage /></ProtectedRoute>} />
                <Route path="/booking-step-deadlines" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><BookingStepDeadlinesPage /></ProtectedRoute>} />
                <Route path="/scheduled-reminders" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><ScheduledRemindersPage /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId/medication-stop-plan" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><MedicationStopPlanPage /></ProtectedRoute>} />
                <Route path="/booking-documents" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><BookingDocumentsPage /></ProtectedRoute>} />
                <Route path="/booking-document-types" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><BookingDocumentTypesPage /></ProtectedRoute>} />
                <Route path="/reserve-lists" element={<ProtectedRoute><ReserveListsPage /></ProtectedRoute>} />
                <Route path="/admin/reserve-lists" element={<ProtectedRoute><ReserveListsPage /></ProtectedRoute>} />
                <Route path="/medical/reserve-lists" element={<ProtectedRoute><ReserveListsPage /></ProtectedRoute>} />
                <Route path="/staff/reserve-lists" element={<ProtectedRoute><ReserveListsPage /></ProtectedRoute>} />
                <Route path="/user/reserve-lists" element={<ProtectedRoute><ReserveListsPage /></ProtectedRoute>} />
                <Route path="/flow-tasks" element={<ProtectedRoute requiredRole={['medical_staff', 'admin']}><FlowTaskInboxPage /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><UnifiedClientManager /></ProtectedRoute>} />
                <Route path="/clients/add" element={<ProtectedRoute><AddClient /></ProtectedRoute>} />
                <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetailsPage /></ProtectedRoute>} />
                <Route path="/screening" element={<ProtectedRoute><ScreeningClientsGrid /></ProtectedRoute>} />
                <Route path="/potential-clients" element={<ProtectedRoute><UnifiedClientManager /></ProtectedRoute>} />
                <Route path="/retreats" element={<ProtectedRoute><RetreatsGrid /></ProtectedRoute>} />
                <Route path="/houses" element={<ProtectedRoute><HousesGrid /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><BookingsGrid /></ProtectedRoute>} />
                <Route path="/bookings/new" element={<ProtectedRoute><BookingEditorPage mode="create" /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId" element={<ProtectedRoute><BookingDetailRoute /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId/edit" element={<ProtectedRoute><BookingEditorPage mode="edit" /></ProtectedRoute>} />
                <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
                <Route path="/payments/:id" element={<ProtectedRoute><PaymentEditorPage /></ProtectedRoute>} />
                <Route path="/payments/:id/edit" element={<ProtectedRoute><PaymentEditorPage /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
                <Route path="/expenses/new" element={<ProtectedRoute><ExpenseEditorPage /></ProtectedRoute>} />
                <Route path="/expenses/:id" element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />
                <Route path="/expenses/:id/edit" element={<ProtectedRoute><ExpenseEditorPage /></ProtectedRoute>} />
                <Route path="/requirements" element={<ProtectedRoute><RequirementsGrid /></ProtectedRoute>} />
              </Routes>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/70 backdrop-blur-apple border-t border-apple-gray-200 h-8">
          <div className="h-full flex items-center justify-center px-4">
            <span className="text-xs text-apple-gray-500">
              Release: 2026-06-11_0700
            </span>
          </div>
        </footer>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-white rounded-apple-xl shadow-apple-xl max-w-lg w-full">
            <CurrencySettings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppleLayout;
