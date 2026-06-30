import React, { useState, useEffect } from 'react';
import AppleButton from './AppleButton';

interface Permission {
  route: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermissions {
  [route: string]: string[]; // route -> allowed roles
}

const NAVIGATION_PERMISSIONS_STORAGE_KEY = 'navigationPermissions:v1';

// Define all available routes and their metadata
const AVAILABLE_PERMISSIONS: Permission[] = [
  { route: 'launcher', name: 'Home / Launcher', description: 'Module launcher and home screen', category: 'Core' },
  { route: 'current-retreat', name: 'Current Retreat Helper', description: 'Current retreat EKG upload and blood pressure entry', category: 'Core' },

  // Client Management
  { route: 'clients', name: 'Client Management', description: 'View and manage client information', category: 'Client Management' },
  { route: 'potential-clients', name: 'Potential Clients', description: 'Manage potential/screening clients', category: 'Client Management' },
  { route: 'screening', name: 'Screenings', description: 'Screening client workflow', category: 'Client Management' },

  // Medical
  { route: 'medical-artifacts', name: 'Medical Artifacts', description: 'Stored medical documents and artifacts', category: 'Medical' },
  { route: 'medical-review-requests', name: 'Medical Review Requests', description: 'Medical review request queue and reviews', category: 'Medical' },
  { route: 'medical-tracking', name: 'Medical Tracking', description: 'Medical document tracking and review', category: 'Medical' },
  { route: 'client-medications', name: 'Client Medications', description: 'Client medication documents and records', category: 'Medical' },
  { route: 'medical-dashboard', name: 'Medical Dashboard', description: 'Medical advisor dashboard', category: 'Medical' },
  { route: 'medical-retreats', name: 'Medical Retreats', description: 'Medical retreat management', category: 'Medical' },
  { route: 'medical', name: 'Medical Profiles', description: 'Client medical profiles', category: 'Medical' },

  // Operations
  { route: 'bookings', name: 'Bookings', description: 'Booking management and scheduling', category: 'Operations' },
  { route: 'retreats', name: 'Retreats', description: 'Retreat management', category: 'Operations' },
  { route: 'ceremonies', name: 'Ceremonies', description: 'Ceremony management and participant tracking', category: 'Operations' },
  { route: 'houses', name: 'Houses', description: 'Property management', category: 'Operations' },
  { route: 'reminders', name: 'Reminders', description: 'Task reminders and notifications', category: 'Operations' },
  { route: 'communications', name: 'Communications', description: 'Client communications and templates', category: 'Operations' },
  { route: 'tasks', name: 'General Tasks', description: 'General task queue', category: 'Operations' },
  { route: 'retreat-flow', name: 'Retreat Readiness', description: 'Retreat-specific readiness workflow', category: 'Operations' },
  { route: 'retreat-flow-library', name: 'Booking Step Setup', description: 'Master booking step configuration', category: 'Operations' },
  { route: 'booking-flow', name: 'Booking Step Deadlines', description: 'Per-booking requirement deadlines and status', category: 'Operations' },
  { route: 'file-uploads', name: 'File Uploads', description: 'File upload inventory', category: 'Operations' },

  // Financial
  { route: 'payments', name: 'Payments', description: 'Payment processing and tracking', category: 'Financial' },
  { route: 'payment-requests', name: 'Payment Requests', description: 'Payment request and invoice management', category: 'Financial' },
  { route: 'requirements', name: 'Requirements', description: 'System requirements management', category: 'Financial' },

  // Administration
  { route: 'analytics', name: 'Analytics', description: 'System analytics and reporting', category: 'Administration' },
  { route: 'users', name: 'User Management', description: 'Manage system users', category: 'Administration' },
  { route: 'permissions', name: 'Permission Management', description: 'Manage role permissions', category: 'Administration' },
  { route: 'backups', name: 'Data Backup', description: 'Export and restore database backups', category: 'Administration' },
];

const ROLES = [
  { key: 'user', name: 'User', description: 'Basic user access', color: 'bg-blue-50 text-blue-700' },
  { key: 'facilitator', name: 'Facilitator', description: 'Retreat and operations staff', color: 'bg-green-50 text-green-700' },
  { key: 'helper', name: 'Helper', description: 'Current retreat EKG and blood pressure entry', color: 'bg-amber-50 text-amber-700' },
  { key: 'medical_staff', name: 'Medical Staff', description: 'Medical advisors and staff', color: 'bg-purple-50 text-purple-700' },
  { key: 'medical_advisor', name: 'Medical Advisor', description: 'External medical review access', color: 'bg-indigo-50 text-indigo-700' },
  { key: 'admin', name: 'Administrator', description: 'Full system access', color: 'bg-red-50 text-red-700' },
];

// Default permission matrix - you can load this from backend later
const DEFAULT_PERMISSIONS: RolePermissions = {
  'launcher': ['user', 'facilitator', 'medical_staff', 'admin'],
  'current-retreat': ['helper', 'admin'],
  'clients': ['user', 'facilitator', 'medical_staff', 'admin'],
  'potential-clients': ['facilitator', 'medical_staff', 'admin'],
  'screening': ['facilitator', 'medical_staff', 'admin'],
  'medical-artifacts': ['medical_staff', 'admin'],
  'medical-review-requests': ['medical_staff', 'medical_advisor', 'admin'],
  'medical-tracking': ['medical_staff', 'admin'],
  'client-medications': ['medical_staff', 'admin'],
  'medical-dashboard': ['medical_staff', 'medical_advisor', 'admin'],
  'medical-retreats': ['medical_staff', 'admin'],
  'medical': ['medical_staff', 'admin'],
  'bookings': ['facilitator', 'medical_staff', 'admin'],
  'retreats': ['facilitator', 'medical_staff', 'admin'],
  'ceremonies': ['facilitator', 'medical_staff', 'admin'],
  'houses': ['facilitator', 'admin'],
  'reminders': ['user', 'facilitator', 'medical_staff', 'admin'],
  'communications': ['user', 'facilitator', 'medical_staff', 'admin'],
  'tasks': ['admin'],
  'retreat-flow': ['medical_staff', 'admin'],
  'retreat-flow-library': ['medical_staff', 'admin'],
  'booking-flow': ['medical_staff', 'admin'],
  'file-uploads': ['medical_staff', 'admin'],
  'payments': ['admin'],
  'payment-requests': ['admin'],
  'requirements': ['admin'],
  'analytics': ['admin'],
  'users': ['admin'],
  'permissions': ['admin'],
};

const getInitialPermissions = () => {
  const saved = localStorage.getItem(NAVIGATION_PERMISSIONS_STORAGE_KEY);
  if (!saved) return DEFAULT_PERMISSIONS;
  try {
    return { ...DEFAULT_PERMISSIONS, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
};

const PermissionsMatrix: React.FC = () => {
  const [permissions, setPermissions] = useState<RolePermissions>(getInitialPermissions);
  const [hasChanges, setHasChanges] = useState(false);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    // Group permissions by category
    const grouped = AVAILABLE_PERMISSIONS.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
    setGroupedPermissions(grouped);
  }, []);

  const togglePermission = (route: string, role: string) => {
    setPermissions(prev => {
      const currentRoles = prev[route] || [];
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];

      setHasChanges(true);
      return {
        ...prev,
        [route]: newRoles
      };
    });
  };

  const hasPermission = (route: string, role: string): boolean => {
    return permissions[route]?.includes(role) || false;
  };

  const savePermissions = async () => {
    try {
      localStorage.setItem(NAVIGATION_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions));
      window.dispatchEvent(new Event('navigationPermissionsChange'));
      setHasChanges(false);
      alert('Permissions saved successfully!');
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error saving permissions. Please try again.');
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset to default permissions? This will lose all customizations.')) {
      setPermissions(DEFAULT_PERMISSIONS);
      localStorage.setItem(NAVIGATION_PERMISSIONS_STORAGE_KEY, JSON.stringify(DEFAULT_PERMISSIONS));
      window.dispatchEvent(new Event('navigationPermissionsChange'));
      setHasChanges(true);
    }
  };

  const getRoleCount = (route: string): number => {
    return permissions[route]?.length || 0;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Permission Management</h1>
        <p className="text-gray-600">
          Control which roles have access to different parts of the system. Higher roles inherit permissions from lower roles.
        </p>

        <div className="flex items-center gap-4 mt-4">
          <AppleButton
            onClick={savePermissions}
            disabled={!hasChanges}
            className={hasChanges ? '' : 'opacity-50'}
          >
            Save Changes
          </AppleButton>
          <AppleButton
            onClick={resetToDefaults}
            variant="secondary"
          >
            Reset to Defaults
          </AppleButton>
          {hasChanges && (
            <span className="text-orange-600 text-sm font-medium">
              ⚠️ Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Role Legend */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-lg font-semibold mb-3">Roles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ROLES.map(role => (
            <div key={role.key} className={`p-3 rounded-lg ${role.color}`}>
              <div className="font-semibold">{role.name}</div>
              <div className="text-sm opacity-80">{role.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
          <div key={category}>
            {/* Category Header */}
            <div className="bg-gray-50 border-b px-6 py-3">
              <h3 className="font-semibold text-gray-900">{category}</h3>
            </div>

            {/* Permissions Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Feature
                    </th>
                    {ROLES.map(role => (
                      <th key={role.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {role.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categoryPermissions.map(permission => (
                    <tr key={permission.route} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {permission.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {permission.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Route: /{permission.route}
                          </div>
                        </div>
                      </td>
                      {ROLES.map(role => (
                        <td key={role.key} className="px-3 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={hasPermission(permission.route, role.key)}
                            onChange={() => togglePermission(permission.route, role.key)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getRoleCount(permission.route) === 0 ? 'bg-red-100 text-red-800' :
                          getRoleCount(permission.route) === ROLES.length ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {getRoleCount(permission.route)}/{ROLES.length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Route Preview */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-lg font-semibold mb-3">Route Structure Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {ROLES.map(role => (
            <div key={role.key} className="space-y-1">
              <div className={`font-semibold p-2 rounded ${role.color}`}>
                {role.name} Routes
              </div>
              <div className="text-gray-600 space-y-1">
                {AVAILABLE_PERMISSIONS
                  .filter(p => hasPermission(p.route, role.key))
                  .map(p => (
                    <div key={p.route} className="text-xs">
                      /{role.key === 'user' ? 'user' : role.key === 'facilitator' ? 'staff' : role.key === 'helper' ? 'helper' : role.key === 'medical_staff' || role.key === 'medical_advisor' ? 'medical' : 'admin'}/{p.route}
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PermissionsMatrix;
