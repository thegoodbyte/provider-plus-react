import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  fallbackPath?: string;
}

const hasRoleAccess = (userRole: string, allowedRoles: string[]) => {
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
};

// Route prefix to allowed role mapping.
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/admin': ['admin'],
  '/medical': ['medical_staff', 'medical_advisor', 'admin'],
  '/staff': ['facilitator', 'medical_staff', 'admin'],
  '/helper': ['helper', 'admin'],
  '/user': ['user', 'facilitator', 'medical_staff', 'admin'],
  // Default routes (backwards compatibility)
  '/medical-tracking': ['medical_staff', 'admin'],
  '/medical-artifacts': ['medical_staff', 'admin'],
  '/clients': ['user', 'facilitator', 'medical_staff', 'admin'],
  '/bookings': ['facilitator', 'medical_staff', 'admin'],
  '/houses': ['facilitator', 'medical_staff', 'admin'],
  '/retreats': ['facilitator', 'medical_staff', 'admin'],
  '/workflow': ['medical_staff', 'admin'],
  '/retreat-flow': ['medical_staff', 'admin'],
  '/retreat-flow-library': ['medical_staff', 'admin'],
  '/booking-flow': ['medical_staff', 'admin'],
  '/flow-tasks': ['medical_staff', 'admin'],
  '/payments': ['admin'],
  '/requirements': ['admin']
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallbackPath = '/unauthorized'
}) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role;
  if (user.accessType === 'medical_review_magic_link') {
    const allowedReviewId = user.medicalReviewRequestId;
    const allowedPaths = allowedReviewId
      ? [
        `/medical/review-requests/${allowedReviewId}`,
        `/medical/review-requests/${allowedReviewId}/edit`,
      ]
      : [];
    if (!allowedPaths.includes(location.pathname)) {
      authService.logout();
      return <Navigate to="/login" state={{ from: location, reason: 'full_login_required' }} replace />;
    }
  }
  if (user.accessType === 'medical_review_group_link') {
    const allowedGroupId = user.medicalReviewGroupId;
    const allowedGroupPath = allowedGroupId ? `/medical/review-groups/${allowedGroupId}` : '';
    const isReviewPath = /^\/medical\/review-requests\/[^/]+(?:\/edit)?$/.test(location.pathname);
    if (!allowedGroupPath || (location.pathname !== allowedGroupPath && !isReviewPath)) {
      authService.logout();
      return <Navigate to="/login" state={{ from: location, reason: 'full_login_required' }} replace />;
    }
  }

  // Check if user has required role (if specified)
  if (requiredRole) {
    if (!hasRoleAccess(userRole, requiredRole)) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  // Check route-based permissions
  const currentPath = location.pathname;

  // Find the matching route prefix
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS).find(route =>
    currentPath === route || currentPath.startsWith(`${route}/`)
  );

  if (matchingRoute) {
    const allowedRolesForRoute = ROUTE_PERMISSIONS[matchingRoute];
    if (!hasRoleAccess(userRole, allowedRolesForRoute)) {
      // Redirect to appropriate route for user's role
      const redirectPath = getRedirectPathForRole(userRole, currentPath);
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

// Helper function to redirect users to appropriate routes for their role
function getRedirectPathForRole(userRole: string, currentPath: string): string {
  const basePath = currentPath.split('/').slice(2).join('/'); // Remove prefix

  switch (userRole) {
    case 'admin':
      return `/admin/${basePath}`;
    case 'medical_staff':
      return `/medical/${basePath}`;
    case 'medical_advisor':
      return `/medical/${basePath}`;
    case 'facilitator':
      return `/staff/${basePath}`;
    case 'helper':
      return `/helper/${basePath || 'current-retreat'}`;
    case 'user':
      return `/user/${basePath}`;
    default:
      return '/unauthorized';
  }
}

export default ProtectedRoute;
