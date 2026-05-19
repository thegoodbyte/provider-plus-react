import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import AppleSidebar from './AppleSidebar';
import UnifiedClientManager from './UnifiedClientManager';
import HousesGrid from './HousesGrid';
import RetreatsGrid from './RetreatsGrid';
import ScreeningClientsGrid from './ScreeningClientsGrid';
import ClientDetailsPage from './ClientDetailsPage';
import ClientEditPage from './ClientEditPage';
import AddClient from '../pages/AddClient';
import ClientScreening from '../pages/ClientScreening';
import RetreatDetailView from '../pages/RetreatDetailView';
// import ClientsGrid from './ClientsGrid'; // Now using UnifiedClientManager
import BookingsGrid from './BookingsGrid';
import BookingEditorPage from './BookingEditorPage';
import MedicalGrid from './MedicalGrid';
import MedicalTrackingNew from './MedicalTrackingNew';
import MedicalTrackingDetail from './MedicalTrackingDetail';
import MedicalTrackingEditPage from './MedicalTrackingEditPage';
import MedicalTrackingFileViewPage from './MedicalTrackingFileViewPage';
import WorkflowDashboard from './WorkflowDashboard';
import RetreatFlowPage from './RetreatFlowPage';
import RetreatFlowLibraryPage from './RetreatFlowLibraryPage';
import BookingFlowPage from './BookingFlowPage';
import FlowTaskInboxPage from './FlowTaskInboxPage';
import MedicalReviewRequestsGrid from './MedicalReviewRequestsGrid';
import MedicalReviewRequestEditorPage from './MedicalReviewRequestEditorPage';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import RemindersPage from './RemindersPage';
import PaymentsPage from './PaymentsPage';
import PaymentEditorPage from './PaymentEditorPage';
import PaymentRequestsGrid from './PaymentRequestsGrid';
import PaymentRequestEditorPage from './PaymentRequestEditorPage';
import CommunicationsPage from './CommunicationsPage';
import RequirementsGrid from './RequirementsGrid';
import CurrencySettings from './CurrencySettings';
import MedicalAdvisorDashboard from './MedicalAdvisorDashboard';
import MedicalReviewDetail from './MedicalReviewDetail';
import MedicalRetreats from './MedicalRetreats';
import MedicalProfile from './MedicalProfile';
import MedicalClientView from './MedicalClientView';
import MedicalAdvisorReview from './MedicalAdvisorReview';
import ModuleLauncherPage from './ModuleLauncherPage';
import ProtectedRoute from './ProtectedRoute';
import Unauthorized from './Unauthorized';
import PermissionsMatrix from './PermissionsMatrix';
import ClientMedicationsGrid from './ClientMedicationsGrid';
import ClientMedicationForm from './ClientMedicationForm';
import UserManagement from './UserManagement';
import { Tasks } from '../pages/Tasks/Tasks';
import { useAuth } from '../context/AuthContext';

const AppleLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isMedicalAdvisor = user?.role === 'medical_advisor';

  const getActiveItemFromPath = () => {
    const path = location.pathname;

    // Handle prefixed routes (admin/, medical/, staff/, user/)
    const pathSegments = path.split('/').filter(Boolean);
    const route = pathSegments.length > 1 ? pathSegments[1] : pathSegments[0];

    // Map routes to sidebar items
    if (route === 'clients' || route === 'potential-clients') return 'clients';
    if (route === 'launcher') return 'launcher';
    if (route === 'medical-dashboard') return 'medical-dashboard';
    if (route === 'medical-review') return 'medical-dashboard';
    if (route === 'medical-retreats') return 'medical-retreats';
    if (route === 'medical-tracking') return 'medical-tracking';
    if (route === 'medical-review-requests') return 'medical-review-requests';
    if (route === 'review-requests') return 'review-requests';
    if (route === 'medical') return 'medical';
    if (route === 'client') return 'medical';
    if (route === 'workflow') return 'workflow';
    if (route === 'retreat-flow') return 'retreat-flow';
    if (route === 'retreat-flow-library') return 'retreat-flow-library';
    if (route === 'booking-flow') return 'booking-flow';
    if (route === 'flow-tasks') return 'flow-tasks';
    if (route === 'retreats') return 'retreats';
    if (route === 'houses') return 'houses';
    if (route === 'bookings') return 'bookings';
    if (route === 'reminders') return 'reminders';
    if (route === 'payments') return 'payments';
    if (route === 'payment-requests') return 'payment-requests';
    if (route === 'communications') return 'communications';
    if (route === 'requirements') return 'requirements';
    if (route === 'analytics') return 'analytics';
    if (route === 'permissions') return 'permissions';
    if (route === 'users') return 'users';
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
        return 'launcher';
      case 'facilitator':
        return 'launcher';
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
      case 'user':
        return 'user';
      default:
        return 'user';
    }
  };

  const activeItem = getActiveItemFromPath();

  useEffect(() => {
    if (location.pathname === '/') {
      const prefix = getRoutePrefix();
      const defaultRoute = getDefaultRoute();
      navigate(`/${prefix}/${defaultRoute}`, { replace: true });
    }
  }, [location.pathname, navigate, user?.role]);

  const handleItemClick = (item: string) => {
    const prefix = getRoutePrefix();
    navigate(`/${prefix}/${item}`);
    setSidebarOpen(false);
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

  return (
    <div className="min-h-screen bg-apple-gray-50">
      {/* Sidebar */}
      <AppleSidebar
        activeItem={activeItem}
        onItemClick={handleItemClick}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        userRole={user?.role}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Header with glass morphism */}
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-apple border-b border-apple-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-apple hover:bg-apple-gray-100 transition-colors flex-shrink-0"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Title */}
              <h1 className="text-xl font-semibold text-apple-gray-900 tracking-tight">
                Provider Plus
              </h1>

                {/* Actions */}
              <div className="flex items-center gap-2">
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
                <button
                  onClick={logout}
                  className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-apple-gray-600 hover:text-apple-gray-900
                           bg-apple-gray-100 hover:bg-apple-gray-200 rounded-apple transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto" style={{ height: 'calc(100vh - 64px - 32px)' }}>
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-apple-lg shadow-apple-sm">
              <Routes>
                {/* Unauthorized route */}
                <Route path="/unauthorized" element={<Unauthorized />} />

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
                      <Route path="retreats/:retreatId" element={<RetreatDetailView />} />
                      <Route path="houses" element={<HousesGrid />} />
                      <Route path="bookings" element={<BookingsGrid />} />
                      <Route path="bookings/new" element={<BookingEditorPage mode="create" />} />
                      <Route path="bookings/:bookingId/edit" element={<BookingEditorPage mode="edit" />} />
                      <Route path="medical-tracking" element={<MedicalTrackingNew />} />
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
                      <Route path="booking-flow/:bookingId" element={<BookingFlowPage />} />
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
                      <Route path="payments/:id/edit" element={<PaymentEditorPage />} />
                      <Route path="payment-requests" element={<PaymentRequestsGrid />} />
                      <Route path="payment-requests/new" element={<PaymentRequestEditorPage />} />
                      <Route path="payment-requests/:id/edit" element={<PaymentRequestEditorPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                      <Route path="requirements" element={<RequirementsGrid />} />
                      <Route path="permissions" element={<PermissionsMatrix />} />
                      <Route path="client-medications" element={<ClientMedicationsGrid />} />
                      <Route path="client-medications/create" element={<ClientMedicationForm mode="create" />} />
                      <Route path="client-medications/edit/:id" element={<ClientMedicationForm mode="edit" />} />
                      <Route path="client-medications/view/:id" element={<ClientMedicationForm mode="view" />} />
                      <Route path="analytics" element={<div className="p-6">Analytics - Coming Soon</div>} />
                      <Route path="users" element={<UserManagement />} />
                      <Route path="tasks" element={<Tasks />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* Medical staff routes */}
                <Route path="/medical/*" element={
                  <ProtectedRoute requiredRole={['medical_staff', 'medical_advisor', 'admin']}>
                    <Routes>
                      <Route index element={<ModuleLauncherPage />} />
                      <Route path="launcher" element={<ModuleLauncherPage />} />
                      <Route path="dashboard" element={<MedicalAdvisorDashboard />} />
                      <Route path="medical-dashboard" element={<MedicalAdvisorDashboard />} />
                      <Route path="tracking" element={<MedicalTrackingNew />} />
                      <Route path="medical-tracking" element={<MedicalTrackingNew />} />
                      <Route path="tracking/:id" element={<MedicalTrackingDetail />} />
                      <Route path="medical-tracking/:id" element={<MedicalTrackingDetail />} />
                      <Route path="medical-tracking/:id/edit" element={<MedicalTrackingEditPage />} />
                      <Route path="medical-tracking/:id/view/:type" element={<MedicalTrackingFileViewPage />} />
                      <Route path="review-requests" element={<MedicalReviewRequestsPage />} />
                      <Route path="review-requests/:id" element={<MedicalReviewRequestsPage />} />
                      <Route path="workflow" element={<WorkflowDashboard />} />
                      <Route path="workflow/bookings/:bookingId" element={<WorkflowDashboard />} />
                      <Route path="retreat-flow" element={<RetreatFlowPage />} />
                      <Route path="retreat-flow/:retreatId" element={<RetreatFlowPage />} />
                      <Route path="retreat-flow-library" element={<RetreatFlowLibraryPage />} />
                      <Route path="booking-flow/:bookingId" element={<BookingFlowPage />} />
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
                      <Route path="bookings/:bookingId/edit" element={<BookingEditorPage mode="edit" />} />
                      <Route path="retreats" element={<RetreatsGrid />} />
                      <Route path="retreats/:retreatId" element={<RetreatDetailView />} />
                      <Route path="reminders" element={<RemindersPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
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
                      <Route path="retreats/:retreatId" element={<RetreatDetailView />} />
                      <Route path="houses" element={<HousesGrid />} />
                      <Route path="clients" element={<UnifiedClientManager />} />
                      <Route path="clients/add" element={<AddClient />} />
                      <Route path="potential-clients" element={<UnifiedClientManager />} />
                      <Route path="reminders" element={<RemindersPage />} />
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
                      <Route path="reminders" element={<RemindersPage />} />
                      <Route path="communications" element={<CommunicationsPage />} />
                    </Routes>
                  </ProtectedRoute>
                } />

                {/* Legacy routes for backwards compatibility - redirect to appropriate prefixed routes */}
                <Route path="/medical-dashboard" element={<ProtectedRoute><MedicalAdvisorDashboard /></ProtectedRoute>} />
                <Route path="/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/medical-review/:bookingId" element={<ProtectedRoute><MedicalReviewDetail /></ProtectedRoute>} />
                <Route path="/medical-retreats" element={<ProtectedRoute><MedicalRetreats /></ProtectedRoute>} />
                <Route path="/medical-tracking" element={<ProtectedRoute><MedicalTrackingNew /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id" element={<ProtectedRoute><MedicalTrackingDetail /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id/edit" element={<ProtectedRoute><MedicalTrackingEditPage /></ProtectedRoute>} />
                <Route path="/medical-tracking/:id/view/:type" element={<ProtectedRoute><MedicalTrackingFileViewPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests" element={<ProtectedRoute><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/medical-review-requests/new" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/:id" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/:id/edit" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/medical-review-requests/*" element={<ProtectedRoute><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/medical/client/:clientId" element={<ProtectedRoute><MedicalClientView /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests" element={<ProtectedRoute><MedicalReviewRequestsGrid /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/new" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/:id" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/admin/medical-review-requests/:id/edit" element={<ProtectedRoute><MedicalReviewRequestEditorPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/medical/review-requests/:id" element={<ProtectedRoute><MedicalReviewRequestsPage /></ProtectedRoute>} />
                <Route path="/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/admin/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/medical/communications" element={<ProtectedRoute><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/admin/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/medical/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/staff/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/user/launcher" element={<ProtectedRoute><ModuleLauncherPage /></ProtectedRoute>} />
                <Route path="/workflow" element={<ProtectedRoute><WorkflowDashboard /></ProtectedRoute>} />
                <Route path="/workflow/bookings/:bookingId" element={<ProtectedRoute><WorkflowDashboard /></ProtectedRoute>} />
                <Route path="/retreat-flow" element={<ProtectedRoute><RetreatFlowPage /></ProtectedRoute>} />
                <Route path="/retreat-flow/:retreatId" element={<ProtectedRoute><RetreatFlowPage /></ProtectedRoute>} />
                <Route path="/retreat-flow-library" element={<ProtectedRoute><RetreatFlowLibraryPage /></ProtectedRoute>} />
                <Route path="/booking-flow/:bookingId" element={<ProtectedRoute><BookingFlowPage /></ProtectedRoute>} />
                <Route path="/flow-tasks" element={<ProtectedRoute><FlowTaskInboxPage /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><UnifiedClientManager /></ProtectedRoute>} />
                <Route path="/clients/add" element={<ProtectedRoute><AddClient /></ProtectedRoute>} />
                <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetailsPage /></ProtectedRoute>} />
                <Route path="/screening" element={<ProtectedRoute><ScreeningClientsGrid /></ProtectedRoute>} />
                <Route path="/potential-clients" element={<ProtectedRoute><UnifiedClientManager /></ProtectedRoute>} />
                <Route path="/retreats" element={<ProtectedRoute><RetreatsGrid /></ProtectedRoute>} />
                <Route path="/houses" element={<ProtectedRoute><HousesGrid /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><BookingsGrid /></ProtectedRoute>} />
                <Route path="/bookings/new" element={<ProtectedRoute><BookingEditorPage mode="create" /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId/edit" element={<ProtectedRoute><BookingEditorPage mode="edit" /></ProtectedRoute>} />
                <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
                <Route path="/requirements" element={<ProtectedRoute><RequirementsGrid /></ProtectedRoute>} />
              </Routes>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white/70 backdrop-blur-apple border-t border-apple-gray-200 h-8">
          <div className="h-full flex items-center justify-center px-4">
            <span className="text-xs text-apple-gray-500">
              Release: 20260516-1423
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
