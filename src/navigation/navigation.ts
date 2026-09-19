import { useEffect, useState } from 'react';

export const NAVIGATION_PERMISSIONS_STORAGE_KEY = 'navigationPermissions:v1';
export const SETTINGS_LABEL = 'Settings & Setup';
export const NAVIGATION: Record<string, { label: string; description: string; setup?: boolean; aliases?: string }> = {
  launcher: { label: 'Home', description: 'Daily work and application setup.' },
  workflow: { label: 'Readiness Dashboard', description: 'Review booking readiness across a retreat and resolve blockers.', aliases: 'Workflow' },
  'booking-flow': { label: 'Booking Requirements', description: 'Track each booking’s required steps, due dates and completion.', aliases: 'Booking Flow' },
  'retreat-flow': { label: 'Retreat Readiness Setup', description: 'Choose the readiness steps required for a retreat.', setup: true },
  'retreat-flow-library': { label: 'Booking Step Library', description: 'Define reusable steps copied into bookings.', setup: true, aliases: 'Booking Step Setup' },
  'booking-document-types': { label: 'Booking Document Types', description: 'Configure document categories and their booking-step links.', setup: true },
  requirements: { label: 'Requirements', description: 'Configure reusable retreat requirements.', setup: true },
  houses: { label: 'Houses', description: 'Manage retreat locations and accommodation.', setup: true },
  announcements: { label: 'Announcement Schedule', description: 'Configure reusable emails before and after retreats.', setup: true },
  'payment-requests': { label: 'Payment Requests', description: 'Create and track amounts requested from clients.', aliases: 'Invoices' },
  payments: { label: 'Payments', description: 'Record and review money received.' },
  'medical-dashboard': { label: 'Medical Dashboard', description: 'Review the queue of medical decisions.' },
  'medical-artifacts': { label: 'Medical Artifacts', description: 'Find uploaded medical records and their reviews.' },
  'medical-tracking': { label: 'Medical Readiness', description: 'Track medical documents and clearance for each client.' },
  'medical-retreats': { label: 'Medical Retreats', description: 'Review medical readiness by retreat.' },
  'medical-review-requests': { label: 'Review Requests', description: 'Review submitted medical records.' },
  'review-requests': { label: 'Review Requests', description: 'Review submitted medical records.' },
  communications: { label: 'Communications', description: 'Send client emails and review message history.', aliases: 'Comms' },
  'client-forms': { label: 'Client Forms', description: 'Review food, medication and questionnaire submissions.' },
  'retreat-staffing': { label: 'Helpers & Cooks', description: 'See and assign the team for each retreat.' },
  users: { label: 'User Management', description: 'Manage staff accounts and access.', setup: true, aliases: 'Users' },
  permissions: { label: 'Permission Management', description: 'Configure navigation visibility for each role.', setup: true, aliases: 'Permissions' },
  backups: { label: 'Data Backup', description: 'Export and restore database backups.', setup: true },
  'audit-logs': { label: 'Audit Logs', description: 'Review recorded changes and staff actions.' },
  analytics: { label: 'Analytics', description: 'Review booking prices and trends.' },
  tasks: { label: 'General Tasks', description: 'Manage the general task queue.' },
};

const operational = ['launcher', 'clients', 'potential-clients', 'screening', 'bookings', 'retreats', 'retreat-staffing', 'ceremonies', 'reminders', 'communications', 'contact-book'];
const roleRoutes: Record<string, string[]> = {
  medical_staff: [...operational, 'workflow', 'flow-tasks', 'medical-dashboard', 'medical-artifacts', 'medical-tracking', 'medical-review-requests', 'review-requests', 'medical', 'medical-retreats', 'client-forms', 'client-medications', 'retreat-flow', 'retreat-flow-library', 'booking-flow', 'booking-step-deadlines', 'scheduled-reminders', 'booking-documents', 'booking-document-types', 'file-uploads', 'assistant', 'needs-attention', 'ir-notifications'],
  medical_advisor: ['medical-dashboard', 'review-requests', 'medical-review-requests'],
  facilitator: [...operational, 'houses', 'booster-offers', 'integration'],
  user: ['launcher', 'clients', 'potential-clients', 'reminders', 'communications', 'contact-book'],
  helper: ['current-retreat'],
};
export type NavigationPreferences = Record<string, string[]>;
const aliasFor = (id: string) => id === 'review-requests' ? 'medical-review-requests' : id === 'potential-clients' ? 'clients' : id;

// Visibility preferences can narrow the routes a role can open, never grant access.
// Support both the route->roles format saved by PermissionsMatrix and older role->routes data.
export function canShowNavigation(id: string, role: string | undefined, preferences: NavigationPreferences = {}): boolean {
  if (!role || (role !== 'admin' && !roleRoutes[role]?.includes(id))) return false;
  const configuredRoles = preferences[id] ?? preferences[aliasFor(id)];
  if (Array.isArray(configuredRoles)) return configuredRoles.includes(role);
  const configuredRoutes = preferences[role];
  if (Array.isArray(configuredRoutes)) return configuredRoutes.includes(id) || configuredRoutes.includes(aliasFor(id));
  return true;
}

export function readNavigationPreferences(): NavigationPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(NAVIGATION_PERMISSIONS_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function useNavigationPreferences() {
  const [preferences, setPreferences] = useState(readNavigationPreferences);
  useEffect(() => {
    const refresh = () => setPreferences(readNavigationPreferences());
    window.addEventListener('storage', refresh);
    window.addEventListener('navigationPermissionsChange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('navigationPermissionsChange', refresh);
    };
  }, []);
  return preferences;
}
